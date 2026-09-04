/*
 * Main application controller for the QR-based augmented-reality viewer.
 *
 * At a high level, this file repeatedly performs the following pipeline:
 *
 *   1. Ask the device for a live camera stream.
 *   2. Draw a camera frame into a small, hidden 2D canvas.
 *   3. Send those pixels to QRClient, which decodes them in a Web Worker.
 *   4. Give the decoded QR corners to POSIT to estimate a 3D pose.
 *   5. Move, rotate, scale, and draw a Three.js model over the QR code.
 *
 * The QR decoder answers asynchronously, while the animation loop continues to
 * draw every available frame. Most state therefore lives in variables shared by
 * the functions below rather than being returned through one synchronous call.
 */

// These libraries were loaded by script tags before main.js. Saving shorter
// local names makes their classes easier to reference throughout this file.
// THREE provides the 3D scene, model loaders, materials, camera, and renderer.
var THREE = window.THREE;
// POS provides the POSIT algorithm, which estimates a 3D pose from four known
// points on a flat object, in this case the four corners of a square QR code.
var POS = window.POS;

// Keep the configuration URL in one place so it is easy to relocate later.
var CONFIG_PATH = './src/config/render-config.json';

// These values are a programmatic baseline. Values successfully loaded from
// render-config.json are recursively merged over this object. Keeping defaults
// here prevents one omitted setting from turning into `undefined` at runtime.
var DEFAULT_APP_CONFIG = {
  // Settings that control camera-frame scanning and QR tracking frequency.
  tracking: {
    // Physical QR size hint supplied to POSIT. It affects translation scale.
    qrSizeMillis: 1000,
    // Older fallback for how long a temporarily missed code remains accepted.
    qrLostGraceMs: 200,
    // Minimum milliseconds between QR decode requests. Zero means every chance.
    scanIntervalMs: 0,
    // Minimum milliseconds between model-pose updates. Zero means every result.
    poseUpdateIntervalMs: 0,
    // Continue using the last pose briefly when one or more decodes miss the QR.
    detectionConfidenceHoldMs: 900,
    // Downscale large camera frames before decoding to reduce processing work.
    maxCameraSize: 800,
    // Empty accepts the decoder's first result; text requires an exact QR match.
    trackMatchingQRCodeData: ''
  },
  // Defaults that describe the virtual Three.js scene and optional text label.
  render: {
    // Text shown in the browser tab or window title bar.
    pageTitle: 'QR AR 3D',
    // A PerspectiveCamera imitates the way distant objects look smaller.
    camera: {
      // Vertical field of view, measured in degrees.
      fov: 75,
      // Objects nearer or farther than these distances are clipped and not drawn.
      near: 1,
      far: 10000,
      // Initial camera position along the virtual Z axis.
      z: 1000
    },
    // Dimensions for the simple cube shown if the configured model cannot load.
    cube: {
      width: 400,
      height: 400,
      depth: 400
    },
    // Position and brightness of the fallback white point light.
    light: {
      x: -20,
      y: 200,
      z: 1000,
      intensity: 1
    },
    // Offsets for the optional 3D label containing the decoded QR text.
    text: {
      yOffset: -400,
      zOffset: 50
    }
  },
  // Settings that turn POSIT's raw, sometimes noisy answer into model movement.
  pose: {
    // Dividing X and Y translation changes how strongly screen motion is applied.
    translationScaleX: 2,
    translationScaleY: 2,
    // Convert POSIT depth into this application's scene-space Z coordinates.
    zReference: 4500,
    zScale: 5,
    // Optional extra correction for distant poses when size scaling is disabled.
    farDepthCompensation: 0,
    // Ignore position changes smaller than this amount; zero disables the rule.
    translationDeadzone: 0,
    // Limit one-frame position or rotation jumps; zero disables each limit.
    maxPositionStep: 0,
    maxRotationStep: 0,
    // Optionally resize the model according to the QR's measured pixel width.
    sizeBasedScaling: {
      enabled: false,
      // Zero learns the first detected size; a positive value fixes the baseline.
      referenceEdgePx: 0,
      // Fraction of each new measurement blended into the saved scale.
      smoothingFactor: 0.25,
      // Bounds prevent one noisy measurement from making the model tiny or huge.
      minMultiplier: 0.25,
      maxMultiplier: 2
    },
    // Rotation values are rounded, then tiny values are treated as zero.
    rotationPrecision: 100,
    rotationDeadzone: 0.1,
    // Shared exponential smoothing for position and, by default, rotation.
    smoothing: {
      enabled: true,
      factor: 0.35
    },
    // Optional per-axis position factors override the shared smoothing factor.
    axisSmoothing: {
      enabled: false,
      xFactor: 0.35,
      yFactor: 0.35,
      zFactor: 0.35
    },
    // Rotation can be enabled and smoothed independently from position.
    rotationSmoothing: {
      enabled: true,
      factor: 0.35
    },
    // Optional per-axis rotation factors override the shared rotation factor.
    rotationAxisSmoothing: {
      enabled: false,
      xFactor: 0.35,
      yFactor: 0.35,
      zFactor: 0.35
    }
  }
};

// JSON serialization creates a deep copy of this data-only object. APP_CONFIG
// can now be replaced or merged without modifying DEFAULT_APP_CONFIG itself.
var APP_CONFIG = JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG));

/**
 * Report whether a value is an ordinary key/value object that can be merged.
 * Arrays are deliberately excluded because configuration arrays should be
 * replaced as complete values rather than merged one numeric index at a time.
 */
function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Recursively copy `target`, then overlay values supplied by `source`.
 *
 * For example, a source containing only `render.camera.fov` changes that one
 * nested value while preserving all sibling camera defaults. The function does
 * not mutate either argument, which makes configuration behavior predictable.
 */
function deepMerge(target, source) {
  // This project stores only JSON-compatible values in configuration, so JSON
  // serialization is a simple way to make a fully independent copy.
  var output = JSON.parse(JSON.stringify(target));
  var key;

  // A non-object source has no named configuration fields to merge.
  if (!isPlainObject(source)) {
    return output;
  }

  // `for...in` visits each enumerable property name on the source object.
  for (key in source) {
    // Ignore properties inherited through JavaScript's prototype chain. Only
    // fields written directly in the configuration object should be trusted.
    if (!source.hasOwnProperty(key)) {
      continue;
    }

    // Descend when both values are objects; otherwise the source replaces the
    // default. This preserves unspecified values at every nested level.
    if (isPlainObject(source[key]) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }

  return output;
}

/** Apply the configured browser-tab title, falling back for blank/bad values. */
function applyConfiguredPageTitle() {
  var configuredTitle = APP_CONFIG && APP_CONFIG.render && APP_CONFIG.render.pageTitle;

  if (typeof configuredTitle !== 'string' || configuredTitle.trim() === '') {
    configuredTitle = DEFAULT_APP_CONFIG.render.pageTitle;
  }

  document.title = configuredTitle;
}

/**
 * Load and merge render-config.json before camera or graphics setup begins.
 *
 * `fetch` is asynchronous and returns a Promise. Returning that Promise lets
 * bootstrap() wait for configuration to finish before it starts the app.
 */
function loadAppConfig() {
  return fetch(CONFIG_PATH)
    .then(function(response) {
      // Fetch rejects for network failures, but HTTP errors such as 404 still
      // resolve normally. Check `ok` and turn those responses into errors.
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' while loading config');
      }
      // Read text instead of response.json() because this project's config uses
      // helpful `//` comments, which strict JSON does not officially support.
      return response.text();
    })
    .then(function(configText) {
      // Remove end-of-line comments before asking the strict JSON parser to read
      // the document. Config string values should therefore not contain `//`.
      var configWithoutComments = configText.replace(/\/\/.*$/gm, '');
      var configFromFile = JSON.parse(configWithoutComments);
      APP_CONFIG = deepMerge(DEFAULT_APP_CONFIG, configFromFile);
      console.log('Loaded app config from', CONFIG_PATH);
    })
    .catch(function(error) {
      // A missing, unreadable, or malformed file should not stop bootstrap. Make
      // a fresh defaults copy and leave an explanation in developer tools.
      APP_CONFIG = JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG));
      console.warn('Falling back to default app config:', error.message || error);
    })
    .then(function() {
      // The file can override the initial default title applied during startup.
      applyConfiguredPageTitle();
    });
}

  // ---------------------------------------------------------------------------
  // Shared runtime state
  // ---------------------------------------------------------------------------

  // The loaded Three.js font is needed only when the optional 3D text is enabled.
var font = null;
  // Legacy prototype value retained for compatibility; it is not currently used.
var STARTING_WORD = 'NodeBots';
  // Ratio between the full camera image and the smaller QR-decoding canvas.
var qrScale = 1;
  // Shared camera/tracking values. Some names (canvas, img, context, video, start,
  // streaming, and detector) remain from the original prototype and are currently
  // unused here. lastBC is the latest accepted barcode; posit estimates its pose.
var canvas, img, context, video, start, streaming, detector, lastBC, posit, scanning, videoPlaying, lastText, lastColor;
  // Core Three.js objects: the scene owns objects, the camera defines the view,
  // and the renderer draws that view into a WebGL canvas.
var scene, camera, renderer;
  // An AnimationMixer acts like a playback controller for animation clips. Keep
  // every active mixer here so the existing frame loop can advance all of them.
var animationMixers = [];
  // Each registration remembers which clips have already started on one root.
  // This prevents a repeated helper call from restarting or duplicating actions.
var animationRegistrations = [];
  // requestAnimationFrame timestamps are milliseconds; saving the previous one
  // lets step() calculate the elapsed seconds required by AnimationMixer.update().
var previousAnimationTimestamp = null;
  // References to the loaded model and optional 3D text. geometry and material are
  // legacy declarations; the active model is stored in mesh.
var geometry, material, mesh, textGeometry, textMesh, textGroup;
  // Timestamps let the app enforce detection grace periods and configurable rates.
var lastDetectionTime = 0;
var lastScanAttemptTime = 0;
var lastPoseUpdateTime = 0;
  // Raw QR measurements jump slightly from frame to frame. This object remembers
  // the previous pose so new values can be blended toward it for steadier motion.
var smoothedPose = {
  initialized: false,
    // x/y/z are position; thetaX/thetaY/thetaZ are rotation angles in radians.
  x: 0,
  y: 0,
  z: 0,
  thetaX: 0,
  thetaY: 0,
  thetaZ: 0
};
// Keep the learned reference width and previous multiplier between frames. This
// makes optional QR-size-based model scaling stable instead of visibly pulsing.
var scaleTracking = {
  initialized: false,
  referenceEdgePx: 0,
  multiplier: 1
};
// Visibility and final model scale are also interpolated across render frames.
// `null` means no rendered scale has been established for this tracking session.
var renderState = {
  visibilityAlpha: 0,
  scale: null
};

// Legacy prototype colors/timestamp retained by the optional text code. The
// current implementation does not select from `colors` or read `lastUpdate`.
var colors = ['#26a9e0','#8a5d3b', '#37b34a', '#a6a8ab', '#f7921e', '#ff459f', '#90278e', '#ed1c24', '#f1f2f3', '#faec31'];
var lastUpdate = Date.now();

// One QRClient owns and reuses the background decoding worker for all frames.
var client = new window.QRClient();

// ---------------------------------------------------------------------------
// QR geometry, smoothing, and visibility helpers
// ---------------------------------------------------------------------------

/**
 * Convert decoder corner pixels into the coordinate system POSIT expects.
 *
 * Image pixels begin at the top-left, with X increasing right and Y increasing
 * down. The 3D pose math expects the image center as (0, 0), with Y increasing
 * up. The decoder may also use a downscaled image, so each coordinate is first
 * multiplied by `scale` to return it to full-camera pixel units.
 */
function centerCorners(corners, canvas, scale) {
  // `map` creates a new four-point array without altering the decoder's result.
  return corners.map(function(corner){
    return {
      // Move the origin horizontally from the left edge to the canvas center.
      x: Math.round((corner.x * scale) - (canvas.width / 2)),
      // Subtract from center to both recenter and invert the vertical direction.
      y: Math.round((canvas.height / 2) - (corner.y * scale))
    };
  });
}

/**
 * Measure the average length, in pixels, of the QR code's four outer edges.
 * A larger on-screen square usually means the physical QR code is closer.
 * getSizeScaleMultiplier() uses this measurement to resize the tracked model.
 */
function getAverageQrEdgeLength(corners) {
  // A quadrilateral needs four points. Return a harmless zero for bad input.
  if (!corners || corners.length < 4) {
    return 0;
  }

  var total = 0;
  var i;
  for (i = 0; i < 4; i++) {
    var a = corners[i];
    // Modulo wraps index 3 back to index 0, closing the square's final edge.
    var b = corners[(i + 1) % 4];
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    // Pythagoras gives the straight-line distance between two pixel points.
    total += Math.sqrt((dx * dx) + (dy * dy));
  }

  return total / 4;
}

/**
 * Calculate a model-scale multiplier from the QR's current on-screen size.
 *
 * The ratio `current edge / reference edge` is 1 at the baseline, below 1 when
 * the QR appears smaller, and above 1 when it appears larger. Configuration can
 * clamp and smooth that ratio before the renderer uses it.
 */
function getSizeScaleMultiplier(corners) {
  // Optional physically grounded scaling mode:
  // model scale follows measured QR size in pixels each frame.
  var scaleCfg = APP_CONFIG.pose.sizeBasedScaling || {};
  if (!scaleCfg.enabled) {
    return 1;
  }

  var measuredEdgePx = getAverageQrEdgeLength(corners);
  // Keep the last stable result when this frame has unusable corner geometry.
  if (!(measuredEdgePx > 0)) {
    return scaleTracking.multiplier || 1;
  }

  var referenceEdgePx = scaleCfg.referenceEdgePx;
  if (!(referenceEdgePx > 0)) {
    // Auto-calibration mode: first valid tracked frame becomes baseline size.
    // This branch also marks runtime state initialized. On that first frame the
    // measured/reference ratio is exactly 1, so smoothing begins at neutral scale.
    if (!scaleTracking.initialized) {
      scaleTracking.referenceEdgePx = measuredEdgePx;
      scaleTracking.multiplier = 1;
      scaleTracking.initialized = true;
    }
    referenceEdgePx = scaleTracking.referenceEdgePx;
  }

  // This can occur only when neither configuration nor auto-calibration
  // produced a positive reference. A neutral multiplier is the safest result.
  if (!(referenceEdgePx > 0)) {
    return 1;
  }

  // If measured QR looks smaller than reference, multiplier shrinks (< 1).
  // If it looks larger, multiplier grows (> 1).
  var multiplier = measuredEdgePx / referenceEdgePx;
  // Clamps limit extreme changes caused by noisy or partial detections.
  if (scaleCfg.minMultiplier !== undefined) {
    multiplier = Math.max(scaleCfg.minMultiplier, multiplier);
  }
  if (scaleCfg.maxMultiplier !== undefined) {
    multiplier = Math.min(scaleCfg.maxMultiplier, multiplier);
  }

  var smoothing = scaleCfg.smoothingFactor;
  if (smoothing > 0 && smoothing < 1) {
    // Exponential smoothing reduces visible "pumping" from noisy detections.
    // With a fixed configured reference, this is the branch that initializes the
    // first multiplier. Auto-calibration initialized it in the earlier branch.
    if (!scaleTracking.initialized) {
      scaleTracking.multiplier = multiplier;
      scaleTracking.initialized = true;
    } else {
      // Move only a fraction of the distance from old value to new value.
      scaleTracking.multiplier += (multiplier - scaleTracking.multiplier) * smoothing;
    }
    multiplier = scaleTracking.multiplier;
  } else {
    scaleTracking.multiplier = multiplier;
    scaleTracking.initialized = true;
  }

  return multiplier;
}

/**
 * Limit how far a numeric value may move during one pose update.
 * This protects the model from one wildly incorrect detection while still
 * allowing it to reach the target over later frames. A nonpositive limit turns
 * clamping off and returns the target unchanged.
 */
function clampDelta(target, current, maxStep) {
  var delta;

  if (!(maxStep > 0)) {
    return target;
  }

  delta = target - current;
  // Preserve the direction of travel while limiting the distance traveled.
  if (delta > maxStep) {
    return current + maxStep;
  }
  if (delta < -maxStep) {
    return current - maxStep;
  }

  return target;
}

/**
 * Apply a 0-to-1 visibility value to one Three.js material.
 *
 * Three.js materials own visual properties such as color and opacity. The
 * original opacity is saved once so fading multiplies it rather than destroying
 * transparency intentionally authored into the model.
 */
function setOpacityOnMaterial(material, alpha) {
  if (!material) {
    return;
  }

  if (!material.userData) {
    // userData is Three.js's supported storage area for application metadata.
    material.userData = {};
  }

  if (material.userData.baseOpacity === undefined) {
    material.userData.baseOpacity = material.opacity !== undefined ? material.opacity : 1;
  }

  // A material must be marked transparent before partial opacity is rendered.
  material.transparent = true;
  material.opacity = material.userData.baseOpacity * alpha;
}

/**
 * Apply one visibility value to every material under a model or group.
 * Imported models can be trees containing many nested meshes, and one mesh may
 * itself use either one material or an array of materials.
 */
function applyVisibilityAlpha(root, alpha) {
  // `traverse` is a Three.js method available on scene graph objects.
  if (!root || !root.traverse) {
    return;
  }

  root.traverse(function(node) {
    var materials;

    // Groups and lights have no material, so there is nothing to fade on them.
    if (!node || !node.material) {
      return;
    }

    // Normalize the one-or-many material forms into an array for one loop.
    materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach(function(material) {
      setOpacityOnMaterial(material, alpha);
    });
  });
}

/**
 * Start each animation clip once on a particular imported object hierarchy.
 *
 * A clip contains keyframes, such as a character's bone rotations over time. An
 * AnimationMixer evaluates those keyframes and writes the resulting transforms
 * onto objects below `root`. One mixer can play several clips simultaneously.
 */
function startAnimationClips(root, clips) {
  if (!root || !Array.isArray(clips) || clips.length === 0) {
    return 0;
  }

  var registration = null;
  var registrationIndex;

  // Reuse an existing mixer if this root has already registered other clips.
  for (registrationIndex = 0; registrationIndex < animationRegistrations.length; registrationIndex++) {
    if (animationRegistrations[registrationIndex].root === root) {
      registration = animationRegistrations[registrationIndex];
      break;
    }
  }

  var alreadyStarted = registration ? registration.clips : [];
  var clipsToStart = [];

  clips.forEach(function(clip) {
    // Ignore missing entries and duplicate references in this or an earlier call.
    if (!clip || alreadyStarted.indexOf(clip) !== -1 || clipsToStart.indexOf(clip) !== -1) {
      return;
    }
    clipsToStart.push(clip);
  });

  // Static models reach this branch with no clips and incur no mixer updates.
  if (clipsToStart.length === 0) {
    return 0;
  }

  var mixer = registration ? registration.mixer : new THREE.AnimationMixer(root);
  var startedCount = 0;

  clipsToStart.forEach(function(clip) {
    try {
      // clipAction creates a playable action; play() uses Three.js's default loop.
      mixer.clipAction(clip).play();
      alreadyStarted.push(clip);
      startedCount++;
    } catch (error) {
      // One malformed clip should not prevent other clips or the model from loading.
      console.warn('Unable to start animation clip:', clip.name || '(unnamed)', error);
    }
  });

  // Do not retain an empty mixer when every supplied clip was unusable.
  if (!registration && startedCount > 0) {
    animationRegistrations.push({
      root: root,
      mixer: mixer,
      clips: alreadyStarted
    });
    animationMixers.push(mixer);
  }

  if (startedCount > 0) {
    console.log('Started model animation clips:', startedCount);
  }

  return startedCount;
}

/** Start clips attached by ObjectLoader to objects in a parsed JSON hierarchy. */
function startObjectAnimations(root) {
  if (!root || !root.traverse) {
    return 0;
  }

  var startedCount = 0;
  root.traverse(function(object) {
    if (object && Array.isArray(object.animations) && object.animations.length > 0) {
      // Rooting the mixer here lets clip track names resolve below this object.
      startedCount += startAnimationClips(object, object.animations);
    }
  });

  return startedCount;
}

// ---------------------------------------------------------------------------
// Three.js model construction and inspection
// ---------------------------------------------------------------------------

/**
 * Build a simple cube to use when the configured asset cannot be loaded.
 *
 * In Three.js, geometry describes an object's shape, a material describes how
 * its surface looks, and a Mesh combines the two into a drawable scene object.
 */
function createFallbackTrackedMesh() {
  // BoxGeometry creates vertices and faces for a rectangular solid.
  var fallbackGeometry = new THREE.BoxGeometry(
    APP_CONFIG.render.cube.width,
    APP_CONFIG.render.cube.height,
    APP_CONFIG.render.cube.depth
  );
  // MeshPhongMaterial reacts to scene lights and can show shiny highlights.
  var fallbackMaterial = new THREE.MeshPhongMaterial({
    // Bright red makes a load failure visually distinct from a real model.
    color: 0xff0000,
    specular: APP_CONFIG.render.model.material.specular,
    shininess: APP_CONFIG.render.model.material.shininess,
    // DoubleSide draws both the inward-facing and outward-facing side of faces.
    side: THREE.DoubleSide,
    wireframe: APP_CONFIG.render.model.material.debugWireframe
  });
  var fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
  // Store unmodified asset scale as metadata so the render loop can multiply it
  // by the optional QR-size scale without losing the original value.
  fallbackMesh.userData.baseUniformScale = 1;
  // Keep the cube hidden until a recent QR detection supplies a valid pose.
  fallbackMesh.visible = false;
  return fallbackMesh;
}

/**
 * Turn geometry loaded from an STL file into the tracked Three.js mesh.
 *
 * STL stores a surface made of triangles but normally contains no materials,
 * lights, hierarchy, or reliable unit metadata. This function computes useful
 * bounds/normals, supplies a material, and converts its authored units.
 */
function createTrackedMeshFromGeometry(stlGeometry, unitScale) {
  // A bounding box records minimum/maximum X, Y, and Z values. A bounding sphere
  // is the smallest practical ball enclosing the shape, represented by center
  // and radius. Three.js and this app use these bounds for placement/debugging.
  stlGeometry.computeBoundingBox();
  stlGeometry.computeBoundingSphere();
  // A normal is a direction perpendicular to a surface. Computing one at each
  // vertex lets Three.js interpolate light smoothly across connected triangles.
  stlGeometry.computeVertexNormals();

  // Defensive `&&` checks avoid reading a child property from a missing object.
  // The final `|| {}` provides an empty object when placement is not configured.
  var modelPlacement = (APP_CONFIG.render && APP_CONFIG.render.model && APP_CONFIG.render.model.placement) || {};
  // Only the exact value "min" selects the minimum face; all else defaults max.
  var bboxZFace = modelPlacement.bboxZFace === 'min' ? 'min' : 'max';

  // STL does not carry a Three.js material, so construct one from app settings.
  var modelMaterial = new THREE.MeshPhongMaterial({
    color: APP_CONFIG.render.model.material.color,
    specular: APP_CONFIG.render.model.material.specular,
    shininess: APP_CONFIG.render.model.material.shininess,
    side: THREE.DoubleSide,
    wireframe: APP_CONFIG.render.model.material.debugWireframe
  });
  var modelMesh = new THREE.Mesh(stlGeometry, modelMaterial);
  // Convert model units into the same broad scale used by POSIT translation,
  // then apply the artist/user-facing model scale from configuration.
  var finalScale = (unitScale / APP_CONFIG.pose.translationScaleX) * APP_CONFIG.render.model.scale;
  // Using one value for all three axes preserves the model's proportions.
  modelMesh.scale.set(finalScale, finalScale, finalScale);
  // Remember baseline scale; render loop may multiply this by QR-size factor.
  modelMesh.userData.baseUniformScale = finalScale;
  // Preserve the authored STL origin. Save the distance to the selected bounding
  // face so the render loop can later place that face against the marker plane.
  if (stlGeometry.boundingBox) {
    modelMesh.userData.localZAnchor = bboxZFace === 'min'
      ? -stlGeometry.boundingBox.min.z
      : stlGeometry.boundingBox.max.z;
  }
  // Loading can finish before tracking starts, so models begin hidden.
  modelMesh.visible = false;
  // Bounds and scale logs are useful when an asset appears offset or enormous.
  if (stlGeometry.boundingBox) {
    console.log('Loaded STL model bounds:', stlGeometry.boundingBox.min, stlGeometry.boundingBox.max, 'bboxZFace:', bboxZFace, 'unitScale:', unitScale, 'finalScale:', finalScale);
  }
  return modelMesh;
}

/**
 * Wrap a glTF/GLB scene in groups that separate asset correction from QR pose.
 *
 * glTF assets can contain many meshes, materials, lights, and nested transforms.
 * Keeping that hierarchy intact inside a Group lets the app move it as one unit.
 */
function createTrackedGroupFromGltf(gltfScene, unitScale, modelExtension) {
  // `group` receives live QR position/rotation/scale. `gltfPoseRoot` holds fixed
  // orientation and placement corrections for the imported asset itself.
  var group = new THREE.Group();
  var gltfPoseRoot = new THREE.Group();
  var modelPlacement = (APP_CONFIG.render && APP_CONFIG.render.model && APP_CONFIG.render.model.placement) || {};
  var placementMode = modelPlacement.mode || 'origin';
  var bboxZFace = modelPlacement.bboxZFace === 'min' ? 'min' : 'max';
  var axisRotationX = 0;
  var posePitchSign = 1;

  // This project's loaders/assets need a quarter-turn around X to align their
  // authored "up" direction with the QR marker plane. GLB also needs pitch
  // reversed when the live POSIT rotation is applied later.
  if (modelExtension === 'gltf') {
    axisRotationX = -Math.PI / 2;
  } else if (modelExtension === 'glb') {
    axisRotationX = Math.PI / 2;
    posePitchSign = -1;
  }
  // A child inherits its parents' transforms. Nesting keeps fixed corrections
  // separate from the outer group's changing tracking transform.
  gltfPoseRoot.rotation.x = axisRotationX;
  gltfPoseRoot.add(gltfScene);
  group.add(gltfPoseRoot);

  // Compute world-aware bounds after applying the fixed axis correction. This is
  // important because rotating an asset changes which extents count as X/Y/Z.
  var bbox = new THREE.Box3().setFromObject(gltfPoseRoot);
  // Negating the selected face coordinate moves that face onto local Z = 0.
  var zAnchor = bboxZFace === 'min' ? -bbox.min.z : -bbox.max.z;

  if (placementMode === 'bbox') {
    // Legacy/easy mode for arbitrary assets:
    // center model in X/Y and anchor one bounds face to QR plane in Z.
    // Choose this when an asset has an unknown or inconvenient artist-created
    // origin. Do not choose it when that intentional origin controls alignment.
    // getCenter writes into a Vector3 supplied by the caller to avoid allocation.
    var center = bbox.getCenter(new THREE.Vector3());
    gltfPoseRoot.position.set(-center.x, -center.y, zAnchor);
  } else if (placementMode === 'originXY_bboxZ') {
    // Hybrid mode:
    // preserve artist-authored X/Y origin, but still auto-anchor Z to QR plane.
    // Choose this when horizontal pivot placement matters but marker-plane contact
    // should still be calculated from the model's bounds.
    gltfPoseRoot.position.set(0, 0, zAnchor);
  } else {
    // Artist-intent mode:
    // preserve authored local origin on all axes (X/Y/Z) at the QR pose.
    // Choose this for an asset deliberately authored around the desired AR pivot.
    gltfPoseRoot.position.set(0, 0, 0);
  }

  // Use a uniform scale so widths, heights, and depths keep their proportions.
  var finalScale = (unitScale / APP_CONFIG.pose.translationScaleX) * APP_CONFIG.render.model.scale;
  group.scale.set(finalScale, finalScale, finalScale);
  // Remember baseline scale; render loop may multiply this by QR-size factor.
  group.userData.baseUniformScale = finalScale;
  // Save a format-specific correction for live pitch in the render loop.
  group.userData.posePitchSign = posePitchSign;
  group.visible = false;

  console.log('Loaded GLTF model bounds:', bbox.min, bbox.max, 'placementMode:', placementMode, 'bboxZFace:', bboxZFace, 'zAnchor:', zAnchor, 'axisRotationX:', axisRotationX, 'posePitchSign:', posePitchSign, 'unitScale:', unitScale, 'finalScale:', finalScale);
  return group;
}

/**
 * Build a tracked mesh from the older Three.js JSON geometry format.
 * This legacy format may provide an array of materials alongside its geometry.
 */
function createTrackedMeshFromJson(geometry, materials, unitScale) {
  // Bounds are computed before centering so diagnostics retain authored extents.
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Move the geometry's own center to local origin so rotations occur around it.
  geometry.center();

  var material;
  if (materials && materials.length > 0) {
    // One material can be used directly. Multiple materials need a container
    // that lets different faces refer to different material indices.
    // In bundled Three.js r132, MeshFaceMaterial is a removed-API compatibility
    // shim that warns and returns this array; newer code should pass the array.
    material = materials.length === 1 ? materials[0] : new THREE.MeshFaceMaterial(materials);
  } else {
    // Supply the same configurable fallback material used for STL geometry.
    material = new THREE.MeshPhongMaterial({
      color: APP_CONFIG.render.model.material.color,
      specular: APP_CONFIG.render.model.material.specular,
      shininess: APP_CONFIG.render.model.material.shininess,
      side: THREE.DoubleSide,
      wireframe: APP_CONFIG.render.model.material.debugWireframe
    });
  }

  var jsonMesh = new THREE.Mesh(geometry, material);
  var finalScale = (unitScale / APP_CONFIG.pose.translationScaleX) * APP_CONFIG.render.model.scale;
  jsonMesh.scale.set(finalScale, finalScale, finalScale);
  // Remember baseline scale; render loop may multiply this by QR-size factor.
  jsonMesh.userData.baseUniformScale = finalScale;
  jsonMesh.visible = false;
  console.log('Loaded JSON model bounds:', geometry.boundingBox.min, geometry.boundingBox.max, 'unitScale:', unitScale, 'finalScale:', finalScale);
  return jsonMesh;
}

/**
 * Decide which of the two incompatible Three.js JSON formats was loaded.
 * `jsonMode` can force an answer; "auto" recognizes common editor/object fields
 * and otherwise falls back to the older geometry-only loader.
 */
function detectJsonModelType(jsonData, jsonMode) {
  // A forced mode is useful when an unusual file cannot be identified reliably.
  if (jsonMode === 'legacy' || jsonMode === 'object') {
    return jsonMode;
  }

  if (!jsonData || !jsonData.metadata) {
    return 'legacy';
  }

  if (jsonData.metadata.type === 'App' && jsonData.scene) {
    return 'object';
  }

  if (jsonData.object && jsonData.geometries) {
    return 'object';
  }

  return 'legacy';
}

/** Parse a modern Three.js object/editor JSON document into a scene object. */
function parseObjectModelFromJson(jsonData) {
  // Fail with a useful message if the installed Three.js build lacks the parser.
  if (!THREE.ObjectLoader) {
    throw new Error('THREE.ObjectLoader is unavailable');
  }

  // ObjectLoader reconstructs geometries, materials, and hierarchy from JSON.
  var objectLoader = new THREE.ObjectLoader();

  // Three.js editor "App" exports place renderable content under scene.
  if (jsonData && jsonData.metadata && jsonData.metadata.type === 'App' && jsonData.scene) {
    return objectLoader.parse(jsonData.scene);
  }

  return objectLoader.parse(jsonData);
}

/**
 * Inspect an imported scene tree and summarize any lights authored into it.
 * Models with their own lights should not receive the app's fallback light too.
 */
function detectEmbeddedLights(root) {
  var lights = [];

  // `traverse` visits the root and every nested child in the scene graph.
  if (root && root.traverse) {
    root.traverse(function(node) {
      if (node && node.isLight) {
        lights.push(node);
      }
    });
  }

  return {
    // Return a summary rather than exposing the mutable light objects themselves.
    hasEmbeddedLights: lights.length > 0,
    count: lights.length,
    types: lights.map(function(light) {
      return light.type;
    })
  };
}

/** Write a concise model-lighting summary to the browser developer console. */
function logEmbeddedLighting(modelFormat, modelPath, lightInfo) {
  if (!lightInfo || !lightInfo.hasEmbeddedLights) {
    console.log('Model lighting detection:', modelFormat, modelPath, '-> no embedded lights detected');
    return;
  }

  console.log('Model lighting detection:', modelFormat, modelPath, '-> embedded lights detected:', lightInfo.count, lightInfo.types.join(', '));
}

/**
 * Load the configured 3D asset and pass a ready-to-track object to `onReady`.
 *
 * Model loading is asynchronous because files must be requested from the web
 * server. Different formats require different Three.js loaders and preparation.
 * Every expected failure falls back to a cube so QR tracking can still be tested.
 *
 * `sceneRef` is retained in this function's API from an earlier implementation;
 * the caller currently adds the returned model to the scene itself.
 */
function loadTrackedMesh(sceneRef, onReady) {
  // Read the extension after the final period and normalize it to lowercase.
  var modelPath = APP_CONFIG.render.model.path;
  var ext = modelPath.split('.').pop().toLowerCase();

  // AR.js convention: 1 GLB/GLTF unit = 1 QR code width. That shared reference
  // makes model size relative to the marker instead of a monitor's pixel density.
  // STL/JSON are treated as mm here (1 mm = 1/qrSizeMillis of a QR width).
  var qrMM = APP_CONFIG.tracking.qrSizeMillis;
  // glTF formats are treated as marker-relative units, while STL and legacy JSON
  // retain their smaller authored units unless configuration overrides them.
  var unitScaleByExt = { gltf: qrMM, glb: qrMM, stl: 1, json: 1 };
  // The ternary operator chooses an explicit modelUnitScale when supplied;
  // otherwise it chooses the format default, then finally a neutral scale of 1.
  var unitScale = (APP_CONFIG.render.model.modelUnitScale !== undefined)
    ? APP_CONFIG.render.model.modelUnitScale
    : (unitScaleByExt[ext] !== undefined ? unitScaleByExt[ext] : 1);
  console.log('Model format:', ext, '— unit scale:', unitScale);

  // glTF (.gltf text or .glb binary) can preserve full scenes and materials.
  if (ext === 'gltf' || ext === 'glb') {
    // Loader scripts are optional globals, so verify one was included by HTML.
    if (!THREE.GLTFLoader) {
      console.warn('THREE.GLTFLoader is unavailable. Falling back to cube mesh.');
      onReady(createFallbackTrackedMesh());
      return;
    }
    var gltfLoader = new THREE.GLTFLoader();
    // Loader.load arguments are URL, success callback, progress callback, and
    // failure callback. This app does not need progress reporting, hence undefined.
    gltfLoader.load(
      modelPath,
      function(gltf) {
        // A glTF loader returns a wrapper; its `.scene` is the root 3D object.
        var gltfLightInfo = detectEmbeddedLights(gltf.scene);
        var trackedGltf = createTrackedGroupFromGltf(gltf.scene, unitScale, ext);
        logEmbeddedLighting(ext, modelPath, gltfLightInfo);
        // GLTFLoader stores imported clips on the result, not reliably on scene.
        // The scene remains the correct mixer root after entering tracking groups.
        startAnimationClips(gltf.scene, gltf.animations);
        // Hand both the prepared model and lighting summary back to startApp().
        onReady(trackedGltf, gltfLightInfo);
      },
      undefined,
      function(error) {
        // Loading errors include missing files, bad data, and unsupported features.
        console.error('Unable to load GLTF model, using fallback cube:', error);
        onReady(createFallbackTrackedMesh(), { hasEmbeddedLights: false, count: 0, types: [] });
      }
    );
    return;
  }

  // A .json file may be either a modern object/scene export or legacy geometry.
  if (ext === 'json') {
    // Fetch the text first so the app can inspect its structure before choosing
    // between ObjectLoader and LegacyJSONLoader.
    fetch(modelPath)
      .then(function(response) {
        // As with configuration loading, HTTP error responses must be checked.
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' while loading JSON model');
        }
        return response.text();
      })
      .then(function(jsonText) {
        // Convert the JSON document from text into ordinary JavaScript objects.
        var jsonData = JSON.parse(jsonText);
        var modelConfig = (APP_CONFIG.render && APP_CONFIG.render.model) || {};
        var jsonMode = modelConfig.jsonMode || 'auto';
        var resolvedJsonType = detectJsonModelType(jsonData, jsonMode);

        // Modern object JSON can represent a complete hierarchy like glTF, so it
        // follows the same grouping, placement, and embedded-light preparation.
        if (resolvedJsonType === 'object') {
          var objectRoot = parseObjectModelFromJson(jsonData);
          var objectJsonLightInfo = detectEmbeddedLights(objectRoot);
          var trackedObject = createTrackedGroupFromGltf(objectRoot, unitScale, ext);
          logEmbeddedLighting(ext, modelPath, objectJsonLightInfo);
          // ObjectLoader attaches each parsed clip array to its owning object.
          startObjectAnimations(objectRoot);
          onReady(trackedObject, objectJsonLightInfo);
          return;
        }

        // Legacy geometry needs the compatibility loader bundled with this app.
        if (!THREE.LegacyJSONLoader) {
          throw new Error('THREE.LegacyJSONLoader is unavailable');
        }

        var jsonLoader = new THREE.LegacyJSONLoader();
  // The legacy loader requests/parses the model and returns bare geometry
  // plus any materials. It does not provide embedded scene lights.
        jsonLoader.load(
          modelPath,
          function(geometry, materials) {
            var legacyJsonLightInfo = { hasEmbeddedLights: false, count: 0, types: [] };
            logEmbeddedLighting(ext, modelPath, legacyJsonLightInfo);
            onReady(createTrackedMeshFromJson(geometry, materials, unitScale), legacyJsonLightInfo);
          },
          undefined,
          function(error) {
            console.error('Unable to load Legacy JSON model, using fallback cube:', error);
            onReady(createFallbackTrackedMesh(), { hasEmbeddedLights: false, count: 0, types: [] });
          }
        );
      })
      .catch(function(error) {
        // This catch handles fetch, JSON parsing, format detection, and object
        // parsing errors from any earlier step in this Promise chain.
        console.error('Unable to load JSON model, using fallback cube:', error);
        onReady(createFallbackTrackedMesh(), { hasEmbeddedLights: false, count: 0, types: [] });
      });
    return;
  }

  // Any extension not handled above follows the original STL loading path.
  if (!THREE.STLLoader) {
    console.warn('THREE.STLLoader is unavailable. Falling back to cube mesh.');
    onReady(createFallbackTrackedMesh());
    return;
  }
  var stlLoader = new THREE.STLLoader();
  // STL success returns triangle geometry only, which the helper turns into a
  // lit mesh. The format cannot contain embedded Three.js scene lights.
  stlLoader.load(
    modelPath,
    function(stlGeometry) {
      onReady(createTrackedMeshFromGeometry(stlGeometry, unitScale), { hasEmbeddedLights: false, count: 0, types: [] });
    },
    undefined,
    function(error) {
      console.error('Unable to load STL model, using fallback cube:', error);
      onReady(createFallbackTrackedMesh(), { hasEmbeddedLights: false, count: 0, types: [] });
    }
  );
}

// ---------------------------------------------------------------------------
// Camera, Three.js scene, and animation setup
// ---------------------------------------------------------------------------

/**
 * Request the camera, initialize the QR decoder inputs and Three.js scene, then
 * start the continuous scan/render loop.
 *
 * This function begins only after configuration and font loading have finished.
 * Most work remains asynchronous: camera permission, video playback, model
 * loading, QR decoding, and browser animation frames all finish at later times.
 */
function startApp() {
  // The <video> element plays the live camera stream behind the transparent 3D
  // canvas. It is defined in index.html and must exist before startApp runs.
  var video = document.getElementById('video');
  // This off-screen canvas is a working surface used only for QR decoding. A
  // smaller image contains fewer pixels and is faster for the worker to inspect.
  var parseVideoCanvas = document.createElement('canvas');
  // A 2D drawing context supplies drawImage() and getImageData() operations.
  var parseVideoCtx = parseVideoCanvas.getContext('2d');
  // This visible canvas is where Three.js draws the model with WebGL.
  var canvas = document.getElementById('canvas');

  // Older browsers used vendor-prefixed camera APIs. Store whichever callback-
  // based implementation exists under one project-specific name. Prefixes let
  // browsers test experimental APIs before standards settled. New applications
  // normally use Promise-based navigator.mediaDevices.getUserMedia() instead.
  navigator.getMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);


  // Ask only for video and prefer a phone/tablet's rear-facing camera. The rear
  // camera lets a user point the screen toward QR codes in the environment.
  var constraints = {
    audio: false,
    video: {
      facingMode: 'environment'
    },
  };

  // Accessing a camera requires user permission. The legacy getUserMedia form
  // receives one callback for success and another for failure.
  navigator.getMedia(constraints, function(stream) {
    // A MediaStream is a live source rather than a downloaded video file. Very
    // old Firefox used mozSrcObject; modern browsers use the standard srcObject.
    if(navigator.mozGetUserMedia){
      video.mozSrcObject = stream;
    }
    else {
      video.srcObject = stream;
    }

    // Modern browsers return a Promise from play(). It resolves when playback has
    // started and rejects when autoplay policy requires user interaction. This
    // legacy compatibility check treats exactly `null` as "no Promise returned";
    // it assumes every other returned value provides `.then()` and `.catch()`.
    var playPromise = video.play();
    if (playPromise !== null) {
      playPromise.then(function() {
        // The animation loop uses this flag to avoid scanning an unstarted video.
        videoPlaying = true;
      })
      .catch(function(err) {
        console.log('didnt like auto playing', err);
        // Mobile browsers commonly require a tap before camera video can play.
        document.body.addEventListener('click', function() {
          if(!videoPlaying) {
            console.log('play on this click');
            video.play();
            videoPlaying = true;
          }
        // `true` listens during the capture phase, making this fallback likely to
        // see the first user gesture even when a child element also handles it.
        }, true);
      });
    }
    else {
      // Compatibility path for an implementation that returns null from play().
      videoPlaying = true;
    }


  }, function(error) {
    // Permission denial, unavailable hardware, or an insecure origin ends camera
    // startup. Logging the browser's error gives a developer the actual reason.
    console.error(error);
  });

  // `canplay` fires after the browser knows the video's real pixel dimensions.
  // Those dimensions are required for canvas sizing, camera aspect, and POSIT.
  video.addEventListener('canplay', function(ev) {

    // console.log('video', video, video.videoHeight, video.videoWidth );
    // A drawing buffer is the pixel grid WebGL fills before the browser displays
    // it. Match that grid to camera resolution so pose coordinates and rendered
    // pixels use the same full-size frame dimensions.
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // POSIT needs a marker-size hint and image width to translate four 2D QR
    // corners into an estimated 3D translation and rotation matrix.
    posit = new POS.Posit(APP_CONFIG.tracking.qrSizeMillis, canvas.width);

    console.log('starting video dimentions', video.videoWidth, video.videoHeight);



  // Compute one downscaling ratio when a camera dimension exceeds the configured
  // limit. A value of 1 keeps native resolution; larger values shrink decoding.
    if(video.videoHeight > APP_CONFIG.tracking.maxCameraSize) {
      qrScale = video.videoHeight / APP_CONFIG.tracking.maxCameraSize;
    }
    else if(video.videoWidth > APP_CONFIG.tracking.maxCameraSize) {
      qrScale = video.videoWidth / APP_CONFIG.tracking.maxCameraSize;
    }

    // Only this hidden decoding canvas is reduced. The visible WebGL canvas stays
    // full resolution, and centerCorners() later expands QR points back by qrScale.
    parseVideoCanvas.width = video.videoWidth / qrScale;
    parseVideoCanvas.height = video.videoHeight / qrScale;

    console.log('scaled video dimentions', parseVideoCanvas.width, parseVideoCanvas.height, 'scale', qrScale);


  // A Scene is the root container for everything Three.js can render.
    scene = new THREE.Scene();

  // A PerspectiveCamera creates depth foreshortening like a physical camera.
  // Aspect ratio must match the video/canvas to avoid stretching the overlay.
    camera = new THREE.PerspectiveCamera(
      APP_CONFIG.render.camera.fov,
      video.videoWidth / video.videoHeight,
      APP_CONFIG.render.camera.near,
      APP_CONFIG.render.camera.far
    );
    // Move the virtual viewpoint away from the scene origin along Z.
    camera.position.z = APP_CONFIG.render.camera.z;

    /** Add configurable white light when an imported asset has no own lights. */
    function addDefaultPointLight(sceneRef) {
      // A point light shines in every direction from one 3D position. 0xffffff is
      // hexadecimal RGB for white, so it preserves the material's configured hue.
      var pointLight = new THREE.PointLight(0xffffff, APP_CONFIG.render.light.intensity);
      pointLight.position.set(
        APP_CONFIG.render.light.x,
        APP_CONFIG.render.light.y,
        APP_CONFIG.render.light.z
      );
      // An object is not rendered or considered by lighting until it joins scene.
      sceneRef.add(pointLight);
      console.log('Using default point light from render config');
    }

    // Loading starts asynchronously. The rest of scene setup can continue while
    // the browser fetches and parses the configured model file.
    loadTrackedMesh(scene, function(loadedMesh, lightInfo) {
      // Keep the returned mesh/group in shared state so every render frame can
      // update the same object's transform rather than rebuilding the model.
      mesh = loadedMesh;
      // Exposing it on window is useful for inspecting transforms in dev tools.
      window.mesh = mesh;
      scene.add(mesh);
      // Initialize all nested materials to the current (normally zero) opacity.
      applyVisibilityAlpha(mesh, renderState.visibilityAlpha);
      mesh.visible = false;

      // Avoid double-lighting a model whose glTF/object scene already defines how
      // it should be lit. Geometry-only formats receive the configurable light.
      if (lightInfo && lightInfo.hasEmbeddedLights) {
        console.log('Using embedded model lights; skipping default point light');
      } else {
        addDefaultPointLight(scene);
      }

      console.log('tracked model loaded', mesh.geometry ? mesh.geometry : mesh);
    });

    // WebGLRenderer turns the virtual scene into pixels in the visible canvas.
    // Alpha support is essential because the camera video must show through.
    renderer = new THREE.WebGLRenderer({canvas: canvas, alpha: true});
    // Clear each frame to fully transparent black instead of an opaque backdrop.
    renderer.setClearColor( 0x000000, 0);



    console.log('scene initialized');

    /**
     * Replace the optional 3D label with geometry for newly decoded QR text.
     * Rebuilding only when text changes avoids expensive font geometry every frame.
     */
    function createText(text) {
      // Capture timing for development diagnostics around geometry creation.
      var createTime = Date.now();
      if(textGroup) {
        // Remove the previous label group so old labels are no longer drawn and
        // retained alongside every newer label, wasting memory and drawing work.
        scene.remove(textGroup);
        console.log('remove text time', Date.now() - createTime);
      }

      // TextGeometry converts font outlines into an extruded 3D triangle mesh.
      textGeometry = new THREE.TextGeometry( text, {
        font: font,
        // `size` controls character height and `height` controls extrusion depth.
        size: 140,
        height: 50,
        curveSegments: 2,
    		bevelEnabled: false,
    		bevelThickness: 6,
    		bevelSize: 8,
    		bevelSegments: 4
      });
      // The bounding box reveals total text width after geometry is generated.
      textGeometry.computeBoundingBox();
      // Offset by half the width so the label is centered around local X = 0.
      var centerOffset = -0.5 * ( textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x );

      // MeshBasicMaterial remains visible without lighting. Legacy text geometry
      // uses one material for front faces and another for extrusion side faces.
      var materials = [
        new THREE.MeshBasicMaterial( { color: lastColor || Math.random() * 0xffffff, overdraw: 0.5 } ),
        new THREE.MeshBasicMaterial( { color: 0x555555, overdraw: 0.5 } )
      ];
      // Combining the generated geometry and materials creates a drawable mesh.
      textMesh = new THREE.Mesh( textGeometry, materials );

      textMesh.position.x = centerOffset;
      // Two PI radians is one complete turn, visually equivalent to no rotation.
      textMesh.rotation.y = Math.PI * 2;
      // A group provides one transform container for the complete label.
      textGroup = new THREE.Group();
      textGroup.add( textMesh );
      scene.add( textGroup );

      // These exports support interactive inspection from browser developer tools.
      window.textMesh = textMesh;
      window.textGroup = textGroup;
      textMesh.centerOffset = centerOffset;
      console.log('text create time', Date.now() - createTime, textMesh);

    }

    /**
     * Draw one visual frame using the newest QR information available.
     *
     * Rendering is independent from decoding: this function can run many times
     * while the worker analyzes one camera image. It reuses the last accepted QR
     * pose briefly, which prevents a single missed decode from causing flicker.
     */
    function render() {
      // Date.now() returns wall-clock milliseconds and is used for all intervals.
      var now = Date.now();
      // Prefer the newer confidence-hold setting. The older grace setting keeps
      // configurations made before that option was introduced working.
      var detectionHoldMs = APP_CONFIG.tracking.detectionConfidenceHoldMs !== undefined
        ? APP_CONFIG.tracking.detectionConfidenceHoldMs
        : APP_CONFIG.tracking.qrLostGraceMs;
      // A saved barcode does not necessarily mean it was seen this frame. Measure
      // its age; Infinity makes the no-barcode case fail all "recent" checks.
      var timeSinceLastDetection = lastBC ? (now - lastDetectionTime) : Number.POSITIVE_INFINITY;
      // `&&` returns a falsy value when there is no barcode and otherwise tests age.
      var hasRecentDetection = lastBC && (timeSinceLastDetection <= detectionHoldMs);
      // Defensive defaults allow older or partially specified config objects.
      var modelConfig = (APP_CONFIG.render && APP_CONFIG.render.model) || {};
      var visibilityLerpConfig = modelConfig.visibilityLerp || {};
      // fadeEnabled is the preferred master option. If absent, preserve the older
      // behavior in which enabling visibility interpolation also enabled fading.
      var fadeEnabled = modelConfig.fadeEnabled !== undefined
        ? modelConfig.fadeEnabled
        : (visibilityLerpConfig.enabled === true);
      // Wait fadeDelayMs after the last match, then optionally fade for a duration.
      var fadeDelayMs = modelConfig.fadeDelayMs !== undefined ? modelConfig.fadeDelayMs : detectionHoldMs;
      var fadeDurationMs = modelConfig.fadeDurationMs !== undefined ? modelConfig.fadeDurationMs : 0;
      var visibilityLerpFactor = visibilityLerpConfig.factor;
      // Alpha means opacity: 0 is fully invisible and 1 is fully opaque.
      var targetVisibilityAlpha = 0;

      // Reject invalid negative/NaN values and substitute meaningful defaults.
      // Unlike `value < 0`, `!(value >= 0)` is true for NaN because every numeric
      // comparison involving JavaScript's "Not a Number" value is false.
      if (!(fadeDelayMs >= 0)) {
        fadeDelayMs = detectionHoldMs;
      }

      if (!(fadeDurationMs >= 0)) {
        fadeDurationMs = 0;
      }

      // lastBC remains stored after the QR disappears, so its timestamp determines
      // whether the model stays opaque, fades, or becomes hidden.
      if (lastBC) {
        if (timeSinceLastDetection <= fadeDelayMs) {
          // The code was seen recently enough to request full visibility.
          targetVisibilityAlpha = 1;
        } else if (fadeEnabled && fadeDurationMs > 0) {
          // Convert elapsed fade time into a straight line from alpha 1 down to 0.
          targetVisibilityAlpha = 1 - ((timeSinceLastDetection - fadeDelayMs) / fadeDurationMs);
          if (targetVisibilityAlpha < 0) {
            // Opacity below zero has no meaning and could confuse renderers.
            targetVisibilityAlpha = 0;
          }
        } else {
          // Fading is disabled or has no duration, so request immediate hiding.
          targetVisibilityAlpha = 0;
        }
      }

      // A timed fade already changes target alpha continuously according to time,
      // so apply it directly. Without one, visibilityLerp can ease toward a target.
      if (fadeDurationMs > 0) {
        renderState.visibilityAlpha = targetVisibilityAlpha;
      } else {
        // A lerp factor must be in (0, 1]. One jumps immediately to the target.
        if (!(visibilityLerpFactor > 0 && visibilityLerpFactor <= 1)) {
          visibilityLerpFactor = 1;
        }
        // Linear interpolation: move this fraction of the remaining distance.
        renderState.visibilityAlpha += (targetVisibilityAlpha - renderState.visibilityAlpha) * visibilityLerpFactor;
      }

      // A recent result permits position/rotation updates. Visibility can outlast
      // this period, but an old pose will not keep changing without fresh corners.
      if(hasRecentDetection) {
        // Model loading may still be in progress even though QR decoding started.
        // Draw the rest of the scene and wait instead of dereferencing undefined.
        if (!mesh) {
          renderer.render(scene, camera);
          return;
        }
        // The boolean avoids drawing effectively invisible geometry; material
        // opacity handles partial fading while alpha remains above the threshold.
        mesh.visible = renderState.visibilityAlpha > 0.01;
        applyVisibilityAlpha(mesh, renderState.visibilityAlpha);
        // Retained for the optional timing log at the end of this branch.
        var renderStart = Date.now();

        // Creating font geometry is expensive, so rebuild the label only when the
        // decoded payload differs from the payload used for the previous label.
        if(lastText !== lastBC.rawValue) {
          lastText = lastBC.rawValue;
          if (APP_CONFIG.render.text.enabled) {
            createText(lastBC.rawValue);
          }
        }

        // Rendering may run faster than desired pose updates. Zero disables this
        // throttle; an uninitialized pose is always allowed to update immediately.
        var poseUpdateIntervalMs = APP_CONFIG.tracking.poseUpdateIntervalMs || 0;
        var shouldUpdatePose = !lastPoseUpdateTime || !smoothedPose.initialized || (now - lastPoseUpdateTime >= poseUpdateIntervalMs);

        if (shouldUpdatePose) {
          // Convert decoder pixels back to centered, Y-up full-camera coordinates.
          var centeredPts = centerCorners(lastBC.cornerPoints, canvas, qrScale);
          // POSIT returns candidate transformations; `bestTranslation` and
          // `bestRotation` are its preferred camera-relative 3D pose.
          var pose = posit.pose(centeredPts);
          // Convert raw horizontal/vertical translation into scene movement.
          var newX = pose.bestTranslation[0] / APP_CONFIG.pose.translationScaleX;
          var newY = pose.bestTranslation[1] / APP_CONFIG.pose.translationScaleY;
          // Keep raw depth temporarily because optional compensation uses it.
          var poseZ = pose.bestTranslation[2];
          // `&&` safely produces false if sizeBasedScaling is absent.
          var sizeBasedScalingEnabled = APP_CONFIG.pose.sizeBasedScaling && APP_CONFIG.pose.sizeBasedScaling.enabled;
          var dynamicScaleMultiplier = getSizeScaleMultiplier(centeredPts);
          // Read all movement guards once so the math below stays understandable.
          var translationDeadzone = APP_CONFIG.pose.translationDeadzone || 0;
          var maxPositionStep = APP_CONFIG.pose.maxPositionStep || 0;
          var maxRotationStep = APP_CONFIG.pose.maxRotationStep || 0;
          var positionSmoothingFactor = APP_CONFIG.pose.smoothing.factor;
          // Optional per-axis position values can replace one shared factor.
          var axisSmoothingConfig = APP_CONFIG.pose.axisSmoothing || {};
          var axisSmoothingEnabled = axisSmoothingConfig.enabled === true;
          // Rotation smoothing defaults to enabled for older configurations.
          var rotationSmoothingConfig = APP_CONFIG.pose.rotationSmoothing || {};
          var rotationSmoothingEnabled = rotationSmoothingConfig.enabled !== undefined
            ? rotationSmoothingConfig.enabled
            : true;
          var rotationSmoothingFactor = rotationSmoothingConfig.factor !== undefined
            ? rotationSmoothingConfig.factor
            : positionSmoothingFactor;
          // A second optional object can tune pitch, yaw, and roll independently.
          var rotationAxisSmoothingConfig = APP_CONFIG.pose.rotationAxisSmoothing || {};
          var rotationAxisSmoothingEnabled = rotationAxisSmoothingConfig.enabled === true;
          // Each ternary chooses its axis override when enabled and present,
          // otherwise falling back to the shared position or rotation factor.
          var positionSmoothingX = axisSmoothingEnabled && axisSmoothingConfig.xFactor !== undefined ? axisSmoothingConfig.xFactor : positionSmoothingFactor;
          var positionSmoothingY = axisSmoothingEnabled && axisSmoothingConfig.yFactor !== undefined ? axisSmoothingConfig.yFactor : positionSmoothingFactor;
          var positionSmoothingZ = axisSmoothingEnabled && axisSmoothingConfig.zFactor !== undefined ? axisSmoothingConfig.zFactor : positionSmoothingFactor;
          var rotationSmoothingX = rotationAxisSmoothingEnabled && rotationAxisSmoothingConfig.xFactor !== undefined ? rotationAxisSmoothingConfig.xFactor : rotationSmoothingFactor;
          var rotationSmoothingY = rotationAxisSmoothingEnabled && rotationAxisSmoothingConfig.yFactor !== undefined ? rotationAxisSmoothingConfig.yFactor : rotationSmoothingFactor;
          var rotationSmoothingZ = rotationAxisSmoothingEnabled && rotationAxisSmoothingConfig.zFactor !== undefined ? rotationAxisSmoothingConfig.zFactor : rotationSmoothingFactor;

          // The legacy depth correction stretches only values beyond zReference.
          // Size-based scaling already responds to apparent distance, so the two
          // corrections are deliberately not combined.
          if (!sizeBasedScalingEnabled && poseZ > APP_CONFIG.pose.zReference && APP_CONFIG.pose.farDepthCompensation > 0) {
            var zDeltaFromReference = poseZ - APP_CONFIG.pose.zReference;
            poseZ = APP_CONFIG.pose.zReference + (zDeltaFromReference * (1 + APP_CONFIG.pose.farDepthCompensation));
          }
          // Shift depth around zReference, invert its direction for this Three.js
          // scene, and divide it into a practical range of scene units.
          var newZ = (APP_CONFIG.pose.zReference - poseZ) / APP_CONFIG.pose.zScale;

          // POSIT expresses orientation as a 3x3 rotation matrix. Each [row][column]
          // entry says how much one rotated basis axis points along another axis.
          // These formulas combine the entries required by this project's axis and
          // rotation-order convention to recover angles around X, Y, and Z. Changing
          // an index or sign would change that convention. atan2 considers signs and
          // quadrants and returns radians from -PI to PI.
          var thetaX = Math.atan2(pose.bestRotation[2][1], pose.bestRotation[2][2]);
          var thetaY = Math.atan2(pose.bestRotation[2][0], Math.sqrt(pose.bestRotation[2][1] * pose.bestRotation[2][1] + pose.bestRotation[2][2] * pose.bestRotation[2][2]) );
          var thetaZ = Math.atan2(pose.bestRotation[1][0], pose.bestRotation[0][0]);

          // Multiplying, rounding, and dividing limits decimal precision. For
          // example, a precision of 100 keeps roughly two decimal places.
          thetaX = Math.round(thetaX * APP_CONFIG.pose.rotationPrecision) / APP_CONFIG.pose.rotationPrecision;
          // A deadzone treats tiny angles as no rotation, reducing visible jitter
          // when the marker is intended to lie straight along an axis.
          if(Math.abs(thetaX) < APP_CONFIG.pose.rotationDeadzone) {
            thetaX = 0;
          }
          thetaY = Math.round(thetaY * APP_CONFIG.pose.rotationPrecision) / APP_CONFIG.pose.rotationPrecision;
          if(Math.abs(thetaY) < APP_CONFIG.pose.rotationDeadzone) {
            thetaY = 0;
          }
          thetaZ = Math.round(thetaZ * APP_CONFIG.pose.rotationPrecision) / APP_CONFIG.pose.rotationPrecision;
          if(Math.abs(thetaZ) < APP_CONFIG.pose.rotationDeadzone) {
            thetaZ = 0;
          }

          // Deadzones and maximum-step limits require a previous pose for
          // comparison, so skip these guards on the first tracked update.
          if (smoothedPose.initialized) {
            if (translationDeadzone > 0) {
              // Reuse the saved axis value when the proposed change is too small
              // to be intentional movement rather than detector noise.
              if (Math.abs(newX - smoothedPose.x) < translationDeadzone) {
                newX = smoothedPose.x;
              }
              if (Math.abs(newY - smoothedPose.y) < translationDeadzone) {
                newY = smoothedPose.y;
              }
              if (Math.abs(newZ - smoothedPose.z) < translationDeadzone) {
                newZ = smoothedPose.z;
              }
            }

            // Clamp each position and angle independently. A configured zero
            // reaches the target immediately because clampDelta disables itself.
            newX = clampDelta(newX, smoothedPose.x, maxPositionStep);
            newY = clampDelta(newY, smoothedPose.y, maxPositionStep);
            newZ = clampDelta(newZ, smoothedPose.z, maxPositionStep);
            thetaX = clampDelta(thetaX, smoothedPose.thetaX, maxRotationStep);
            thetaY = clampDelta(thetaY, smoothedPose.thetaY, maxRotationStep);
            thetaZ = clampDelta(thetaZ, smoothedPose.thetaZ, maxRotationStep);
          }

          // Smoothing reduces frame-to-frame jitter by retaining part of the old
          // pose. Smaller factors look steadier but take longer to follow motion.
          if (APP_CONFIG.pose.smoothing.enabled) {
            if (!smoothedPose.initialized) {
              // Seed from the first real pose rather than blending from zeros,
              // which would make a newly shown model slide in from the origin.
              smoothedPose.initialized = true;
              smoothedPose.x = newX;
              smoothedPose.y = newY;
              smoothedPose.z = newZ;
              smoothedPose.thetaX = thetaX;
              smoothedPose.thetaY = thetaY;
              smoothedPose.thetaZ = thetaZ;
            } else {
              // This is exponential smoothing: old + (new - old) * factor.
              smoothedPose.x += (newX - smoothedPose.x) * positionSmoothingX;
              smoothedPose.y += (newY - smoothedPose.y) * positionSmoothingY;
              smoothedPose.z += (newZ - smoothedPose.z) * positionSmoothingZ;
              if (rotationSmoothingEnabled) {
                // Rotation uses its own factors because orientation noise often
                // needs stronger smoothing than position noise.
                smoothedPose.thetaX += (thetaX - smoothedPose.thetaX) * rotationSmoothingX;
                smoothedPose.thetaY += (thetaY - smoothedPose.thetaY) * rotationSmoothingY;
                smoothedPose.thetaZ += (thetaZ - smoothedPose.thetaZ) * rotationSmoothingZ;
              } else {
                // Keep position smoothing but apply each new rotation immediately.
                smoothedPose.thetaX = thetaX;
                smoothedPose.thetaY = thetaY;
                smoothedPose.thetaZ = thetaZ;
              }
            }

            // From this point onward, rendering should use the filtered values,
            // not the noisy raw values originally returned by POSIT.
            newX = smoothedPose.x;
            newY = smoothedPose.y;
            newZ = smoothedPose.z;
            thetaX = smoothedPose.thetaX;
            thetaY = smoothedPose.thetaY;
            thetaZ = smoothedPose.thetaZ;
          }

          // Apply tracked horizontal/vertical position plus optional manual
          // alignment offsets from render-config.json.
          mesh.position.x = newX + APP_CONFIG.render.model.positionOffset.x;
          mesh.position.y = newY + APP_CONFIG.render.model.positionOffset.y;

          // `undefined` means this asset has no saved uniform base scale. Every
          // model constructed by this file normally provides one in userData.
          var dynamicScale = undefined;
          if (mesh.userData && mesh.userData.baseUniformScale !== undefined) {
            // This is a second, final smoothing stage after the QR-size multiplier
            // is combined with the model's authored/configured baseline scale.
            var scaleSmoothingConfig = (APP_CONFIG.render && APP_CONFIG.render.model && APP_CONFIG.render.model.scaleSmoothing) || {};
            var scaleSmoothingEnabled = scaleSmoothingConfig.enabled === true;
            var scaleSmoothingFactor = scaleSmoothingConfig.factor;
            // Multiplication preserves the baseline when multiplier is 1.
            var targetScale = mesh.userData.baseUniformScale * dynamicScaleMultiplier;

            // Invalid scale factors become 1, which follows the target immediately.
            if (!(scaleSmoothingFactor > 0 && scaleSmoothingFactor <= 1)) {
              scaleSmoothingFactor = 1;
            }

            if (scaleSmoothingEnabled) {
              if (renderState.scale === null) {
                // Seed the first value directly so it does not grow from zero.
                renderState.scale = targetScale;
              } else {
                // Blend a fraction of the remaining difference on each update.
                renderState.scale += (targetScale - renderState.scale) * scaleSmoothingFactor;
              }
              dynamicScale = renderState.scale;
            } else {
              dynamicScale = targetScale;
              renderState.scale = targetScale;
            }

            // Set X, Y, and Z equally to avoid stretching the model's proportions.
            mesh.scale.set(dynamicScale, dynamicScale, dynamicScale);
          }

          // STL meshes can save the distance from their origin to a selected
          // bounding-box face. Convert that local distance into scaled scene units.
          var anchorOffsetZ = 0;
          if (mesh.userData && mesh.userData.localZAnchor !== undefined) {
            var anchorScale = dynamicScale;
            // Fall back to the baseline if dynamic scaling was not calculated.
            if (anchorScale === undefined && mesh.userData.baseUniformScale !== undefined) {
              anchorScale = mesh.userData.baseUniformScale;
            }
            if (anchorScale !== undefined) {
              anchorOffsetZ = mesh.userData.localZAnchor * anchorScale;
            }
          }
          // Subtracting the anchor offset places the selected model face on the
          // tracked marker plane, then adds any user-configured Z adjustment.
          mesh.position.z = newZ + APP_CONFIG.render.model.positionOffset.z - anchorOffsetZ;

          // GLB wrapping stores -1 because its corrected axes need pitch reversed;
          // other formats use the neutral multiplier of 1.
          var posePitchSign = mesh.userData && mesh.userData.posePitchSign !== undefined
            ? mesh.userData.posePitchSign
            : 1;
          // Three.js rotations are radians. Configured offsets make permanent
          // artist alignment adjustments on top of the live tracked orientation.
          mesh.rotation.x = (thetaX * posePitchSign) + APP_CONFIG.render.model.rotationOffset.x;
          mesh.rotation.y = thetaY + APP_CONFIG.render.model.rotationOffset.y;
          mesh.rotation.z = thetaZ + APP_CONFIG.render.model.rotationOffset.z;

          // Keep the optional label near the same QR pose. It has its own offsets
          // so text can sit above/in front of the model instead of intersecting it.
          if(textGroup) {
            textGroup.visible = APP_CONFIG.render.text.enabled;
            textGroup.position.x = newX;
            textGroup.position.y = newY + APP_CONFIG.render.text.yOffset;
            textGroup.position.z = newZ + APP_CONFIG.render.text.zOffset;
            textGroup.rotation.x = thetaX;
            textGroup.rotation.y = thetaY;
            textGroup.rotation.z = thetaZ;
          }

          // Record completion time so poseUpdateIntervalMs can throttle later frames.
          lastPoseUpdateTime = now;
        }

        // Draw even when pose updating was throttled; visibility and the rest of
        // the scene may still have changed since the previous animation frame.
        renderer.render( scene, camera );
        // console.log('render end', Date.now() - renderStart);

      } else {
        // No sufficiently recent pose is available. Continue drawing while the
        // configured visibility behavior finishes hiding the last known model.
        if (mesh) {
          mesh.visible = renderState.visibilityAlpha > 0.01;
          applyVisibilityAlpha(mesh, renderState.visibilityAlpha);
        }
        if (textGroup) {
          // Text has no material-fade traversal here, so hide it immediately.
          textGroup.visible = false;
        }
        // Once effectively invisible, clear interpolation state. The next valid
        // detection will seed directly from its actual pose/scale instead of
        // traveling from stale values left by a previous tracking session.
        if (renderState.visibilityAlpha <= 0.01) {
          smoothedPose.initialized = false;
          lastPoseUpdateTime = 0;
          renderState.scale = null;
          renderState.visibilityAlpha = 0;
          // Return scale to a neutral multiplier. The learned reference edge
          // remains stored, so later tracking uses the same calibrated baseline.
          scaleTracking.multiplier = 1;
        }
        // The camera/video continues separately, but WebGL must still clear and
        // draw its transparent canvas while no fresh QR pose exists.
        renderer.render(scene, camera);

      }
    }


    /**
     * Process one browser animation opportunity, then schedule the next one.
     *
     * requestAnimationFrame supplies a high-resolution timestamp in milliseconds.
     * Animation mixers use it here; QR hold and scan timers continue using Date.now().
     */
    function step(timestamp) {
      // The first frame has no previous timestamp, so its safe elapsed time is 0.
      // Dividing by 1000 converts later frame gaps from milliseconds to seconds,
      // which is the time unit required by THREE.AnimationMixer.update().
      var deltaSeconds = 0;
      var mixerIndex;
      if (previousAnimationTimestamp !== null) {
        deltaSeconds = Math.max(0, (timestamp - previousAnimationTimestamp) / 1000);
      }
      previousAnimationTimestamp = timestamp;

      // Advance animation independently from QR scans, pose throttling, and model
      // visibility. Losing and reacquiring the QR therefore does not restart clips.
      for (mixerIndex = 0; mixerIndex < animationMixers.length; mixerIndex++) {
        animationMixers[mixerIndex].update(deltaSeconds);
      }

      // QR decoding runs in a worker, but copying pixels and sending requests
      // still starts here. `scanning` prevents overlapping worker requests, which
      // could return out of order and waste CPU on stale camera frames.
      if(videoPlaying && !scanning && Date.now() - lastScanAttemptTime >= APP_CONFIG.tracking.scanIntervalMs) {
        // Lock immediately, before pixel copying, so only one request can start.
        scanning = true;
        lastScanAttemptTime = Date.now();
        // Draw the current video frame into the smaller hidden canvas. Scaling is
        // automatic because destination width/height differ from the video source.
        parseVideoCtx.drawImage(video, 0,0, parseVideoCanvas.width, parseVideoCanvas.height);
        // var decodeStart = Date.now();
        // Send pixels plus the optional exact payload rule to the QR worker.
        // This callback runs later when qrworker.js posts its answer.
        client.decode(parseVideoCtx, APP_CONFIG.tracking.trackMatchingQRCodeData, function(bc) {
          // console.log('decode time', Date.now() - decodeStart);
          // Save the previous accepted result only for change logging below.
          var previousBC = lastBC;
          // Every worker answer, including "nothing found", unlocks the next scan.
          scanning = false;
          if(bc) {
            // Only an accepted result replaces tracking geometry and refreshes
            // detection time. A miss leaves lastBC in place so it can age out
            // smoothly according to detectionConfidenceHoldMs and fade settings.
            lastBC = bc;
            lastDetectionTime = Date.now();
            // This normally fires when unfiltered tracking switches between codes.
            if(previousBC && previousBC.rawValue !== bc.rawValue) {
              console.log('new barcode', bc);
            }
            // console.log('bc', bc);
          }
        });
      }
      // Rendering always happens, even while video is not ready or QR decoding is
      // busy. render() reads shared lastBC; JavaScript harmlessly ignores this
      // extra argument retained from the original implementation.
      render(lastBC);
      // Ask the browser to call step again just before its next visual repaint.
      // Scheduling once at the end avoids recursive call-stack growth.
      window.requestAnimationFrame(step);
    }

    // Start the self-scheduling animation loop after scene initialization.
    window.requestAnimationFrame(step);


  });
}

// ---------------------------------------------------------------------------
// Ordered application startup
// ---------------------------------------------------------------------------

/** Load prerequisites in order, then begin camera and graphics initialization. */
function bootstrap() {
  // Returning Promises from each `.then` makes the next step wait for completion.
  loadAppConfig()
    .then(function() {
      // The font is loaded even when labels are disabled so it is ready if the
      // setting is enabled. Fetch returns a Promise for the HTTP response.
      return fetch('./src/fonts/optimer_regular.typeface.json');
    })
    .then(function(response) {
      // Parse the downloaded JSON asynchronously into a JavaScript object.
      return response.json();
    })
    .then(function(fontData) {
      // THREE.Font prepares glyph outline data for TextGeometry.
      font = new THREE.Font(fontData);
      // Configuration and font data are now ready, so camera startup can begin.
      startApp();
    })
    .catch(function(error) {
      // A font fetch or parse failure prevents optional text geometry and stops
      // startup here. Configuration failures are already handled in loadAppConfig.
      console.error('Unable to load font data:', error);
    });
}

// Scripts can execute before the HTML parser has created the video/canvas nodes.
// If so, wait for DOMContentLoaded; otherwise bootstrap immediately. Registering
// only one path guarantees that camera initialization starts once.
// Set a useful title immediately; loadAppConfig() replaces it if config differs.
applyConfiguredPageTitle();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
