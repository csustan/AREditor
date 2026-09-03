var THREE = window.THREE;
var POS = window.POS;

var CONFIG_PATH = './src/config/render-config.json';

var DEFAULT_APP_CONFIG = {
  tracking: {
    qrSizeMillis: 1000,
    qrLostGraceMs: 200,
    scanIntervalMs: 0,
    poseUpdateIntervalMs: 0,
    detectionConfidenceHoldMs: 900,
    maxCameraSize: 800
  },
  render: {
    camera: {
      fov: 75,
      near: 1,
      far: 10000,
      z: 1000
    },
    cube: {
      width: 400,
      height: 400,
      depth: 400
    },
    light: {
      x: -20,
      y: 200,
      z: 1000,
      intensity: 1
    },
    text: {
      yOffset: -400,
      zOffset: 50
    }
  },
  pose: {
    translationScaleX: 2,
    translationScaleY: 2,
    zReference: 4500,
    zScale: 5,
    farDepthCompensation: 0,
    translationDeadzone: 0,
    maxPositionStep: 0,
    maxRotationStep: 0,
    sizeBasedScaling: {
      enabled: false,
      referenceEdgePx: 0,
      smoothingFactor: 0.25,
      minMultiplier: 0.25,
      maxMultiplier: 2
    },
    rotationPrecision: 100,
    rotationDeadzone: 0.1,
    smoothing: {
      enabled: true,
      factor: 0.35
    },
    axisSmoothing: {
      enabled: false,
      xFactor: 0.35,
      yFactor: 0.35,
      zFactor: 0.35
    },
    rotationSmoothing: {
      enabled: true,
      factor: 0.35
    },
    rotationAxisSmoothing: {
      enabled: false,
      xFactor: 0.35,
      yFactor: 0.35,
      zFactor: 0.35
    }
  }
};

var APP_CONFIG = JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG));

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target, source) {
  var output = JSON.parse(JSON.stringify(target));
  var key;

  if (!isPlainObject(source)) {
    return output;
  }

  for (key in source) {
    if (!source.hasOwnProperty(key)) {
      continue;
    }

    if (isPlainObject(source[key]) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }

  return output;
}

function loadAppConfig() {
  return fetch(CONFIG_PATH)
    .then(function(response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' while loading config');
      }
      return response.text();
    })
    .then(function(configText) {
      var configWithoutComments = configText.replace(/\/\/.*$/gm, '');
      var configFromFile = JSON.parse(configWithoutComments);
      APP_CONFIG = deepMerge(DEFAULT_APP_CONFIG, configFromFile);
      console.log('Loaded app config from', CONFIG_PATH);
    })
    .catch(function(error) {
      APP_CONFIG = JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG));
      console.warn('Falling back to default app config:', error.message || error);
    });
}

var font = null;
var STARTING_WORD = 'NodeBots';
var qrScale = 1;
var canvas, img, context, video, start, streaming, detector, lastBC, posit, scanning, videoPlaying, lastText, lastColor;
var scene, camera, renderer;
var geometry, material, mesh, textGeometry, textMesh, textGroup;
var lastDetectionTime = 0;
var lastScanAttemptTime = 0;
var lastPoseUpdateTime = 0;
var smoothedPose = {
  initialized: false,
  x: 0,
  y: 0,
  z: 0,
  thetaX: 0,
  thetaY: 0,
  thetaZ: 0
};
// Tracks runtime state for QR-size-based scaling so scale changes are stable.
var scaleTracking = {
  initialized: false,
  referenceEdgePx: 0,
  multiplier: 1
};
var renderState = {
  visibilityAlpha: 0,
  scale: null
};

var colors = ['#26a9e0','#8a5d3b', '#37b34a', '#a6a8ab', '#f7921e', '#ff459f', '#90278e', '#ed1c24', '#f1f2f3', '#faec31'];
var lastUpdate = Date.now();

var client = new window.QRClient();

function centerCorners(corners, canvas, scale) {
  return corners.map(function(corner){
    return {
      x: Math.round((corner.x * scale) - (canvas.width / 2)),
      y: Math.round((canvas.height / 2) - (corner.y * scale))
    };
  });
}

function getAverageQrEdgeLength(corners) {
  if (!corners || corners.length < 4) {
    return 0;
  }

  var total = 0;
  var i;
  for (i = 0; i < 4; i++) {
    var a = corners[i];
    var b = corners[(i + 1) % 4];
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    total += Math.sqrt((dx * dx) + (dy * dy));
  }

  return total / 4;
}

function getSizeScaleMultiplier(corners) {
  // Optional physically grounded scaling mode:
  // model scale follows measured QR size in pixels each frame.
  var scaleCfg = APP_CONFIG.pose.sizeBasedScaling || {};
  if (!scaleCfg.enabled) {
    return 1;
  }

  var measuredEdgePx = getAverageQrEdgeLength(corners);
  if (!(measuredEdgePx > 0)) {
    return scaleTracking.multiplier || 1;
  }

  var referenceEdgePx = scaleCfg.referenceEdgePx;
  if (!(referenceEdgePx > 0)) {
    // Auto-calibration mode: first valid tracked frame becomes baseline size.
    if (!scaleTracking.initialized) {
      scaleTracking.referenceEdgePx = measuredEdgePx;
      scaleTracking.multiplier = 1;
      scaleTracking.initialized = true;
    }
    referenceEdgePx = scaleTracking.referenceEdgePx;
  }

  if (!(referenceEdgePx > 0)) {
    return 1;
  }

  // If measured QR looks smaller than reference, multiplier shrinks (< 1).
  // If it looks larger, multiplier grows (> 1).
  var multiplier = measuredEdgePx / referenceEdgePx;
  if (scaleCfg.minMultiplier !== undefined) {
    multiplier = Math.max(scaleCfg.minMultiplier, multiplier);
  }
  if (scaleCfg.maxMultiplier !== undefined) {
    multiplier = Math.min(scaleCfg.maxMultiplier, multiplier);
  }

  var smoothing = scaleCfg.smoothingFactor;
  if (smoothing > 0 && smoothing < 1) {
    // Exponential smoothing reduces visible "pumping" from noisy detections.
    if (!scaleTracking.initialized) {
      scaleTracking.multiplier = multiplier;
      scaleTracking.initialized = true;
    } else {
      scaleTracking.multiplier += (multiplier - scaleTracking.multiplier) * smoothing;
    }
    multiplier = scaleTracking.multiplier;
  } else {
    scaleTracking.multiplier = multiplier;
    scaleTracking.initialized = true;
  }

  return multiplier;
}

function clampDelta(target, current, maxStep) {
  var delta;

  if (!(maxStep > 0)) {
    return target;
  }

  delta = target - current;
  if (delta > maxStep) {
    return current + maxStep;
  }
  if (delta < -maxStep) {
    return current - maxStep;
  }

  return target;
}

function setOpacityOnMaterial(material, alpha) {
  if (!material) {
    return;
  }

  if (!material.userData) {
    material.userData = {};
  }

  if (material.userData.baseOpacity === undefined) {
    material.userData.baseOpacity = material.opacity !== undefined ? material.opacity : 1;
  }

  material.transparent = true;
  material.opacity = material.userData.baseOpacity * alpha;
}

function applyVisibilityAlpha(root, alpha) {
  if (!root || !root.traverse) {
    return;
  }

  root.traverse(function(node) {
    var materials;

    if (!node || !node.material) {
      return;
    }

    materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach(function(material) {
      setOpacityOnMaterial(material, alpha);
    });
  });
}

function createFallbackTrackedMesh() {
  var fallbackGeometry = new THREE.BoxGeometry(
    APP_CONFIG.render.cube.width,
    APP_CONFIG.render.cube.height,
    APP_CONFIG.render.cube.depth
  );
  var fallbackMaterial = new THREE.MeshPhongMaterial({
    color: APP_CONFIG.render.model.material.color,
    specular: APP_CONFIG.render.model.material.specular,
    shininess: APP_CONFIG.render.model.material.shininess,
    side: THREE.DoubleSide,
    wireframe: APP_CONFIG.render.model.material.debugWireframe
  });
  var fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
  // Store unmodified asset scale so dynamic multiplier can be applied later.
  fallbackMesh.userData.baseUniformScale = 1;
  fallbackMesh.visible = false;
  return fallbackMesh;
}

function createTrackedMeshFromGeometry(stlGeometry, unitScale) {
  stlGeometry.computeBoundingBox();
  stlGeometry.computeBoundingSphere();
  stlGeometry.computeVertexNormals();

  var modelPlacement = (APP_CONFIG.render && APP_CONFIG.render.model && APP_CONFIG.render.model.placement) || {};
  var bboxZFace = modelPlacement.bboxZFace === 'min' ? 'min' : 'max';

  var modelMaterial = new THREE.MeshPhongMaterial({
    color: APP_CONFIG.render.model.material.color,
    specular: APP_CONFIG.render.model.material.specular,
    shininess: APP_CONFIG.render.model.material.shininess,
    side: THREE.DoubleSide,
    wireframe: APP_CONFIG.render.model.material.debugWireframe
  });
  var modelMesh = new THREE.Mesh(stlGeometry, modelMaterial);
  var finalScale = (unitScale / APP_CONFIG.pose.translationScaleX) * APP_CONFIG.render.model.scale;
  modelMesh.scale.set(finalScale, finalScale, finalScale);
  // Remember baseline scale; render loop may multiply this by QR-size factor.
  modelMesh.userData.baseUniformScale = finalScale;
  // Preserve authored STL origin, but keep floor anchor metadata for optional plane contact.
  if (stlGeometry.boundingBox) {
    modelMesh.userData.localZAnchor = bboxZFace === 'min'
      ? -stlGeometry.boundingBox.min.z
      : stlGeometry.boundingBox.max.z;
  }
  modelMesh.visible = false;
  if (stlGeometry.boundingBox) {
    console.log('Loaded STL model bounds:', stlGeometry.boundingBox.min, stlGeometry.boundingBox.max, 'bboxZFace:', bboxZFace, 'unitScale:', unitScale, 'finalScale:', finalScale);
  }
  return modelMesh;
}

function createTrackedGroupFromGltf(gltfScene, unitScale, modelExtension) {
  var group = new THREE.Group();
  var gltfPoseRoot = new THREE.Group();
  var modelPlacement = (APP_CONFIG.render && APP_CONFIG.render.model && APP_CONFIG.render.model.placement) || {};
  var placementMode = modelPlacement.mode || 'origin';
  var bboxZFace = modelPlacement.bboxZFace === 'min' ? 'min' : 'max';
  var axisRotationX = 0;
  var posePitchSign = 1;

  if (modelExtension === 'gltf') {
    axisRotationX = -Math.PI / 2;
  } else if (modelExtension === 'glb') {
    axisRotationX = Math.PI / 2;
    posePitchSign = -1;
  }
  gltfPoseRoot.rotation.x = axisRotationX;
  gltfPoseRoot.add(gltfScene);
  group.add(gltfPoseRoot);

  // Compute bounds for diagnostics and optional bbox-based placement mode.
  var bbox = new THREE.Box3().setFromObject(gltfPoseRoot);
  var zAnchor = bboxZFace === 'min' ? -bbox.min.z : -bbox.max.z;

  if (placementMode === 'bbox') {
    // Legacy/easy mode for arbitrary assets:
    // center model in X/Y and anchor one bounds face to QR plane in Z.
    var center = bbox.getCenter(new THREE.Vector3());
    gltfPoseRoot.position.set(-center.x, -center.y, zAnchor);
  } else if (placementMode === 'originXY_bboxZ') {
    // Hybrid mode:
    // preserve artist-authored X/Y origin, but still auto-anchor Z to QR plane.
    gltfPoseRoot.position.set(0, 0, zAnchor);
  } else {
    // Artist-intent mode:
    // preserve authored local origin on all axes (X/Y/Z) at the QR pose.
    gltfPoseRoot.position.set(0, 0, 0);
  }

  var finalScale = (unitScale / APP_CONFIG.pose.translationScaleX) * APP_CONFIG.render.model.scale;
  group.scale.set(finalScale, finalScale, finalScale);
  // Remember baseline scale; render loop may multiply this by QR-size factor.
  group.userData.baseUniformScale = finalScale;
  group.userData.posePitchSign = posePitchSign;
  group.visible = false;

  console.log('Loaded GLTF model bounds:', bbox.min, bbox.max, 'placementMode:', placementMode, 'bboxZFace:', bboxZFace, 'zAnchor:', zAnchor, 'axisRotationX:', axisRotationX, 'posePitchSign:', posePitchSign, 'unitScale:', unitScale, 'finalScale:', finalScale);
  return group;
}

function createTrackedMeshFromJson(geometry, materials, unitScale) {
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  geometry.center();

  var material;
  if (materials && materials.length > 0) {
    material = materials.length === 1 ? materials[0] : new THREE.MeshFaceMaterial(materials);
  } else {
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

function detectJsonModelType(jsonData, jsonMode) {
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

function parseObjectModelFromJson(jsonData) {
  if (!THREE.ObjectLoader) {
    throw new Error('THREE.ObjectLoader is unavailable');
  }

  var objectLoader = new THREE.ObjectLoader();

  // Three.js editor "App" exports place renderable content under scene.
  if (jsonData && jsonData.metadata && jsonData.metadata.type === 'App' && jsonData.scene) {
    return objectLoader.parse(jsonData.scene);
  }

  return objectLoader.parse(jsonData);
}

function detectEmbeddedLights(root) {
  var lights = [];

  if (root && root.traverse) {
    root.traverse(function(node) {
      if (node && node.isLight) {
        lights.push(node);
      }
    });
  }

  return {
    hasEmbeddedLights: lights.length > 0,
    count: lights.length,
    types: lights.map(function(light) {
      return light.type;
    })
  };
}

function logEmbeddedLighting(modelFormat, modelPath, lightInfo) {
  if (!lightInfo || !lightInfo.hasEmbeddedLights) {
    console.log('Model lighting detection:', modelFormat, modelPath, '-> no embedded lights detected');
    return;
  }

  console.log('Model lighting detection:', modelFormat, modelPath, '-> embedded lights detected:', lightInfo.count, lightInfo.types.join(', '));
}

function loadTrackedMesh(sceneRef, onReady) {
  var modelPath = APP_CONFIG.render.model.path;
  var ext = modelPath.split('.').pop().toLowerCase();

  // AR.js convention: 1 GLB/GLTF unit = 1 QR code width. STL/JSON are in mm (1mm = 1/qrSizeMillis QR).
  var qrMM = APP_CONFIG.tracking.qrSizeMillis;
  var unitScaleByExt = { gltf: qrMM, glb: qrMM, stl: 1, json: 1 };
  var unitScale = (APP_CONFIG.render.model.modelUnitScale !== undefined)
    ? APP_CONFIG.render.model.modelUnitScale
    : (unitScaleByExt[ext] !== undefined ? unitScaleByExt[ext] : 1);
  console.log('Model format:', ext, '— unit scale:', unitScale);

  if (ext === 'gltf' || ext === 'glb') {
    if (!THREE.GLTFLoader) {
      console.warn('THREE.GLTFLoader is unavailable. Falling back to cube mesh.');
      onReady(createFallbackTrackedMesh());
      return;
    }
    var gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load(
      modelPath,
      function(gltf) {
        var gltfLightInfo = detectEmbeddedLights(gltf.scene);
        logEmbeddedLighting(ext, modelPath, gltfLightInfo);
        onReady(createTrackedGroupFromGltf(gltf.scene, unitScale, ext), gltfLightInfo);
      },
      undefined,
      function(error) {
        console.error('Unable to load GLTF model, using fallback cube:', error);
        onReady(createFallbackTrackedMesh(), { hasEmbeddedLights: false, count: 0, types: [] });
      }
    );
    return;
  }

  // JSON path
  if (ext === 'json') {
    fetch(modelPath)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' while loading JSON model');
        }
        return response.text();
      })
      .then(function(jsonText) {
        var jsonData = JSON.parse(jsonText);
        var modelConfig = (APP_CONFIG.render && APP_CONFIG.render.model) || {};
        var jsonMode = modelConfig.jsonMode || 'auto';
        var resolvedJsonType = detectJsonModelType(jsonData, jsonMode);

        if (resolvedJsonType === 'object') {
          var objectRoot = parseObjectModelFromJson(jsonData);
          var objectJsonLightInfo = detectEmbeddedLights(objectRoot);
          logEmbeddedLighting(ext, modelPath, objectJsonLightInfo);
          onReady(createTrackedGroupFromGltf(objectRoot, unitScale, ext), objectJsonLightInfo);
          return;
        }

        if (!THREE.LegacyJSONLoader) {
          throw new Error('THREE.LegacyJSONLoader is unavailable');
        }

        var jsonLoader = new THREE.LegacyJSONLoader();
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
        console.error('Unable to load JSON model, using fallback cube:', error);
        onReady(createFallbackTrackedMesh(), { hasEmbeddedLights: false, count: 0, types: [] });
      });
    return;
  }

  // Default: STL path
  if (!THREE.STLLoader) {
    console.warn('THREE.STLLoader is unavailable. Falling back to cube mesh.');
    onReady(createFallbackTrackedMesh());
    return;
  }
  var stlLoader = new THREE.STLLoader();
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

function startApp() {
  var video = document.getElementById('video');
  var parseVideoCanvas = document.createElement('canvas');
  var parseVideoCtx = parseVideoCanvas.getContext('2d');
  var canvas = document.getElementById('canvas');

  navigator.getMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);


  var constraints = {
    audio: false,
    video: {
      facingMode: 'environment'
    },
  };

  navigator.getMedia(constraints, function(stream) {
    if(navigator.mozGetUserMedia){
      video.mozSrcObject = stream;
    }
    else {
      video.srcObject = stream;
    }

    var playPromise = video.play();
    if (playPromise !== null) {
      playPromise.then(function() {
        videoPlaying = true;
      })
      .catch(function(err) {
        console.log('didnt like auto playing', err);
        //mobile needs a touch to start playing
        document.body.addEventListener('click', function() {
          if(!videoPlaying) {
            console.log('play on this click');
            video.play();
            videoPlaying = true;
          }
        }, true);
      });
    }
    else {
      videoPlaying = true;
    }


  }, function(error) {
    console.error(error);
  });

  video.addEventListener('canplay', function(ev) {

    // console.log('video', video, video.videoHeight, video.videoWidth );
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    posit = new POS.Posit(APP_CONFIG.tracking.qrSizeMillis, canvas.width);

    console.log('starting video dimentions', video.videoWidth, video.videoHeight);



    if(video.videoHeight > APP_CONFIG.tracking.maxCameraSize) {
      qrScale = video.videoHeight / APP_CONFIG.tracking.maxCameraSize;
    }
    else if(video.videoWidth > APP_CONFIG.tracking.maxCameraSize) {
      qrScale = video.videoWidth / APP_CONFIG.tracking.maxCameraSize;
    }

    parseVideoCanvas.width = video.videoWidth / qrScale;
    parseVideoCanvas.height = video.videoHeight / qrScale;

    console.log('scaled video dimentions', parseVideoCanvas.width, parseVideoCanvas.height, 'scale', qrScale);


    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      APP_CONFIG.render.camera.fov,
      video.videoWidth / video.videoHeight,
      APP_CONFIG.render.camera.near,
      APP_CONFIG.render.camera.far
    );
    camera.position.z = APP_CONFIG.render.camera.z;

    function addDefaultPointLight(sceneRef) {
      var pointLight = new THREE.PointLight(0xffffff, APP_CONFIG.render.light.intensity);
      pointLight.position.set(
        APP_CONFIG.render.light.x,
        APP_CONFIG.render.light.y,
        APP_CONFIG.render.light.z
      );
      sceneRef.add(pointLight);
      console.log('Using default point light from render config');
    }

    loadTrackedMesh(scene, function(loadedMesh, lightInfo) {
      mesh = loadedMesh;
      window.mesh = mesh;
      scene.add(mesh);
      applyVisibilityAlpha(mesh, renderState.visibilityAlpha);
      mesh.visible = false;

      if (lightInfo && lightInfo.hasEmbeddedLights) {
        console.log('Using embedded model lights; skipping default point light');
      } else {
        addDefaultPointLight(scene);
      }

      console.log('tracked model loaded', mesh.geometry ? mesh.geometry : mesh);
    });

    renderer = new THREE.WebGLRenderer({canvas: canvas, alpha: true});
    renderer.setClearColor( 0x000000, 0);



    console.log('scene initialized');

    function createText(text) {
      var createTime = Date.now();
      if(textGroup) {
        scene.remove(textGroup);
        console.log('remove text time', Date.now() - createTime);
      }

      textGeometry = new THREE.TextGeometry( text, {
        font: font,
        size: 140,
        height: 50,
        curveSegments: 2,
    		bevelEnabled: false,
    		bevelThickness: 6,
    		bevelSize: 8,
    		bevelSegments: 4
      });
      textGeometry.computeBoundingBox();
      var centerOffset = -0.5 * ( textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x );

      var materials = [
        new THREE.MeshBasicMaterial( { color: lastColor || Math.random() * 0xffffff, overdraw: 0.5 } ),
        new THREE.MeshBasicMaterial( { color: 0x555555, overdraw: 0.5 } )
      ];
      textMesh = new THREE.Mesh( textGeometry, materials );

      textMesh.position.x = centerOffset;
      textMesh.rotation.y = Math.PI * 2;
      textGroup = new THREE.Group();
      textGroup.add( textMesh );
      scene.add( textGroup );

      window.textMesh = textMesh;
      window.textGroup = textGroup;
      textMesh.centerOffset = centerOffset;
      console.log('text create time', Date.now() - createTime, textMesh);

    }

    function render() {
      var now = Date.now();
      var detectionHoldMs = APP_CONFIG.tracking.detectionConfidenceHoldMs !== undefined
        ? APP_CONFIG.tracking.detectionConfidenceHoldMs
        : APP_CONFIG.tracking.qrLostGraceMs;
      var timeSinceLastDetection = lastBC ? (now - lastDetectionTime) : Number.POSITIVE_INFINITY;
      var hasRecentDetection = lastBC && (timeSinceLastDetection <= detectionHoldMs);
      var modelConfig = (APP_CONFIG.render && APP_CONFIG.render.model) || {};
      var visibilityLerpConfig = modelConfig.visibilityLerp || {};
      var fadeEnabled = modelConfig.fadeEnabled !== undefined
        ? modelConfig.fadeEnabled
        : (visibilityLerpConfig.enabled === true);
      var fadeDelayMs = modelConfig.fadeDelayMs !== undefined ? modelConfig.fadeDelayMs : detectionHoldMs;
      var fadeDurationMs = modelConfig.fadeDurationMs !== undefined ? modelConfig.fadeDurationMs : 0;
      var visibilityLerpFactor = visibilityLerpConfig.factor;
      var targetVisibilityAlpha = 0;

      if (!(fadeDelayMs >= 0)) {
        fadeDelayMs = detectionHoldMs;
      }

      if (!(fadeDurationMs >= 0)) {
        fadeDurationMs = 0;
      }

      if (lastBC) {
        if (timeSinceLastDetection <= fadeDelayMs) {
          targetVisibilityAlpha = 1;
        } else if (fadeEnabled && fadeDurationMs > 0) {
          targetVisibilityAlpha = 1 - ((timeSinceLastDetection - fadeDelayMs) / fadeDurationMs);
          if (targetVisibilityAlpha < 0) {
            targetVisibilityAlpha = 0;
          }
        } else {
          targetVisibilityAlpha = 0;
        }
      }

      if (fadeDurationMs > 0) {
        renderState.visibilityAlpha = targetVisibilityAlpha;
      } else {
        if (!(visibilityLerpFactor > 0 && visibilityLerpFactor <= 1)) {
          visibilityLerpFactor = 1;
        }
        renderState.visibilityAlpha += (targetVisibilityAlpha - renderState.visibilityAlpha) * visibilityLerpFactor;
      }

      if(hasRecentDetection) {
        if (!mesh) {
          renderer.render(scene, camera);
          return;
        }
        mesh.visible = renderState.visibilityAlpha > 0.01;
        applyVisibilityAlpha(mesh, renderState.visibilityAlpha);
        var renderStart = Date.now();

        if(lastText !== lastBC.rawValue) {
          lastText = lastBC.rawValue;
          if (APP_CONFIG.render.text.enabled) {
            createText(lastBC.rawValue);
          }
        }

        var poseUpdateIntervalMs = APP_CONFIG.tracking.poseUpdateIntervalMs || 0;
        var shouldUpdatePose = !lastPoseUpdateTime || !smoothedPose.initialized || (now - lastPoseUpdateTime >= poseUpdateIntervalMs);

        if (shouldUpdatePose) {
          var centeredPts = centerCorners(lastBC.cornerPoints, canvas, qrScale);
          var pose = posit.pose(centeredPts);
          var newX = pose.bestTranslation[0] / APP_CONFIG.pose.translationScaleX;
          var newY = pose.bestTranslation[1] / APP_CONFIG.pose.translationScaleY;
          var poseZ = pose.bestTranslation[2];
          var sizeBasedScalingEnabled = APP_CONFIG.pose.sizeBasedScaling && APP_CONFIG.pose.sizeBasedScaling.enabled;
          var dynamicScaleMultiplier = getSizeScaleMultiplier(centeredPts);
          var translationDeadzone = APP_CONFIG.pose.translationDeadzone || 0;
          var maxPositionStep = APP_CONFIG.pose.maxPositionStep || 0;
          var maxRotationStep = APP_CONFIG.pose.maxRotationStep || 0;
          var positionSmoothingFactor = APP_CONFIG.pose.smoothing.factor;
          var axisSmoothingConfig = APP_CONFIG.pose.axisSmoothing || {};
          var axisSmoothingEnabled = axisSmoothingConfig.enabled === true;
          var rotationSmoothingConfig = APP_CONFIG.pose.rotationSmoothing || {};
          var rotationSmoothingEnabled = rotationSmoothingConfig.enabled !== undefined
            ? rotationSmoothingConfig.enabled
            : true;
          var rotationSmoothingFactor = rotationSmoothingConfig.factor !== undefined
            ? rotationSmoothingConfig.factor
            : positionSmoothingFactor;
          var rotationAxisSmoothingConfig = APP_CONFIG.pose.rotationAxisSmoothing || {};
          var rotationAxisSmoothingEnabled = rotationAxisSmoothingConfig.enabled === true;
          var positionSmoothingX = axisSmoothingEnabled && axisSmoothingConfig.xFactor !== undefined ? axisSmoothingConfig.xFactor : positionSmoothingFactor;
          var positionSmoothingY = axisSmoothingEnabled && axisSmoothingConfig.yFactor !== undefined ? axisSmoothingConfig.yFactor : positionSmoothingFactor;
          var positionSmoothingZ = axisSmoothingEnabled && axisSmoothingConfig.zFactor !== undefined ? axisSmoothingConfig.zFactor : positionSmoothingFactor;
          var rotationSmoothingX = rotationAxisSmoothingEnabled && rotationAxisSmoothingConfig.xFactor !== undefined ? rotationAxisSmoothingConfig.xFactor : rotationSmoothingFactor;
          var rotationSmoothingY = rotationAxisSmoothingEnabled && rotationAxisSmoothingConfig.yFactor !== undefined ? rotationAxisSmoothingConfig.yFactor : rotationSmoothingFactor;
          var rotationSmoothingZ = rotationAxisSmoothingEnabled && rotationAxisSmoothingConfig.zFactor !== undefined ? rotationAxisSmoothingConfig.zFactor : rotationSmoothingFactor;

          if (!sizeBasedScalingEnabled && poseZ > APP_CONFIG.pose.zReference && APP_CONFIG.pose.farDepthCompensation > 0) {
            var zDeltaFromReference = poseZ - APP_CONFIG.pose.zReference;
            poseZ = APP_CONFIG.pose.zReference + (zDeltaFromReference * (1 + APP_CONFIG.pose.farDepthCompensation));
          }
          var newZ = (APP_CONFIG.pose.zReference - poseZ) / APP_CONFIG.pose.zScale;

          var thetaX = Math.atan2(pose.bestRotation[2][1], pose.bestRotation[2][2]);
          var thetaY = Math.atan2(pose.bestRotation[2][0], Math.sqrt(pose.bestRotation[2][1] * pose.bestRotation[2][1] + pose.bestRotation[2][2] * pose.bestRotation[2][2]) );
          var thetaZ = Math.atan2(pose.bestRotation[1][0], pose.bestRotation[0][0]);

          thetaX = Math.round(thetaX * APP_CONFIG.pose.rotationPrecision) / APP_CONFIG.pose.rotationPrecision;
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

          if (smoothedPose.initialized) {
            if (translationDeadzone > 0) {
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

            newX = clampDelta(newX, smoothedPose.x, maxPositionStep);
            newY = clampDelta(newY, smoothedPose.y, maxPositionStep);
            newZ = clampDelta(newZ, smoothedPose.z, maxPositionStep);
            thetaX = clampDelta(thetaX, smoothedPose.thetaX, maxRotationStep);
            thetaY = clampDelta(thetaY, smoothedPose.thetaY, maxRotationStep);
            thetaZ = clampDelta(thetaZ, smoothedPose.thetaZ, maxRotationStep);
          }

          if (APP_CONFIG.pose.smoothing.enabled) {
            if (!smoothedPose.initialized) {
              smoothedPose.initialized = true;
              smoothedPose.x = newX;
              smoothedPose.y = newY;
              smoothedPose.z = newZ;
              smoothedPose.thetaX = thetaX;
              smoothedPose.thetaY = thetaY;
              smoothedPose.thetaZ = thetaZ;
            } else {
              smoothedPose.x += (newX - smoothedPose.x) * positionSmoothingX;
              smoothedPose.y += (newY - smoothedPose.y) * positionSmoothingY;
              smoothedPose.z += (newZ - smoothedPose.z) * positionSmoothingZ;
              if (rotationSmoothingEnabled) {
                smoothedPose.thetaX += (thetaX - smoothedPose.thetaX) * rotationSmoothingX;
                smoothedPose.thetaY += (thetaY - smoothedPose.thetaY) * rotationSmoothingY;
                smoothedPose.thetaZ += (thetaZ - smoothedPose.thetaZ) * rotationSmoothingZ;
              } else {
                smoothedPose.thetaX = thetaX;
                smoothedPose.thetaY = thetaY;
                smoothedPose.thetaZ = thetaZ;
              }
            }

            newX = smoothedPose.x;
            newY = smoothedPose.y;
            newZ = smoothedPose.z;
            thetaX = smoothedPose.thetaX;
            thetaY = smoothedPose.thetaY;
            thetaZ = smoothedPose.thetaZ;
          }

          mesh.position.x = newX + APP_CONFIG.render.model.positionOffset.x;
          mesh.position.y = newY + APP_CONFIG.render.model.positionOffset.y;

          var dynamicScale = undefined;
          if (mesh.userData && mesh.userData.baseUniformScale !== undefined) {
            var scaleSmoothingConfig = (APP_CONFIG.render && APP_CONFIG.render.model && APP_CONFIG.render.model.scaleSmoothing) || {};
            var scaleSmoothingEnabled = scaleSmoothingConfig.enabled === true;
            var scaleSmoothingFactor = scaleSmoothingConfig.factor;
            var targetScale = mesh.userData.baseUniformScale * dynamicScaleMultiplier;

            if (!(scaleSmoothingFactor > 0 && scaleSmoothingFactor <= 1)) {
              scaleSmoothingFactor = 1;
            }

            if (scaleSmoothingEnabled) {
              if (renderState.scale === null) {
                renderState.scale = targetScale;
              } else {
                renderState.scale += (targetScale - renderState.scale) * scaleSmoothingFactor;
              }
              dynamicScale = renderState.scale;
            } else {
              dynamicScale = targetScale;
              renderState.scale = targetScale;
            }

            mesh.scale.set(dynamicScale, dynamicScale, dynamicScale);
          }

          var anchorOffsetZ = 0;
          if (mesh.userData && mesh.userData.localZAnchor !== undefined) {
            var anchorScale = dynamicScale;
            if (anchorScale === undefined && mesh.userData.baseUniformScale !== undefined) {
              anchorScale = mesh.userData.baseUniformScale;
            }
            if (anchorScale !== undefined) {
              anchorOffsetZ = mesh.userData.localZAnchor * anchorScale;
            }
          }
          mesh.position.z = newZ + APP_CONFIG.render.model.positionOffset.z - anchorOffsetZ;

          var posePitchSign = mesh.userData && mesh.userData.posePitchSign !== undefined
            ? mesh.userData.posePitchSign
            : 1;
          mesh.rotation.x = (thetaX * posePitchSign) + APP_CONFIG.render.model.rotationOffset.x;
          mesh.rotation.y = thetaY + APP_CONFIG.render.model.rotationOffset.y;
          mesh.rotation.z = thetaZ + APP_CONFIG.render.model.rotationOffset.z;

          if(textGroup) {
            textGroup.visible = APP_CONFIG.render.text.enabled;
            textGroup.position.x = newX;
            textGroup.position.y = newY + APP_CONFIG.render.text.yOffset;
            textGroup.position.z = newZ + APP_CONFIG.render.text.zOffset;
            textGroup.rotation.x = thetaX;
            textGroup.rotation.y = thetaY;
            textGroup.rotation.z = thetaZ;
          }

          lastPoseUpdateTime = now;
        }

        renderer.render( scene, camera );
        // console.log('render end', Date.now() - renderStart);

      } else {
        if (mesh) {
          mesh.visible = renderState.visibilityAlpha > 0.01;
          applyVisibilityAlpha(mesh, renderState.visibilityAlpha);
        }
        if (textGroup) {
          textGroup.visible = false;
        }
        if (renderState.visibilityAlpha <= 0.01) {
          smoothedPose.initialized = false;
          lastPoseUpdateTime = 0;
          renderState.scale = null;
          renderState.visibilityAlpha = 0;
          // Reset dynamic scale state between tracking sessions to avoid stale multipliers.
          scaleTracking.multiplier = 1;
        }
        renderer.render(scene, camera);

      }
    }


    function step(timestamp) {

      // might be scanning on own thread, but should always render
      if(videoPlaying && !scanning && Date.now() - lastScanAttemptTime >= APP_CONFIG.tracking.scanIntervalMs) {
        scanning = true;
        lastScanAttemptTime = Date.now();
        parseVideoCtx.drawImage(video, 0,0, parseVideoCanvas.width, parseVideoCanvas.height);
        // var decodeStart = Date.now();
        client.decode(parseVideoCtx, function(bc) {
          // console.log('decode time', Date.now() - decodeStart);
          var previousBC = lastBC;
          scanning = false;
          if(bc) {
            lastBC = bc;
            lastDetectionTime = Date.now();
            if(previousBC && previousBC.rawValue !== bc.rawValue) {
              console.log('new barcode', bc);
            }
            // console.log('bc', bc);
          }
        });
      }
      render(lastBC);
      window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);


  });
}

function bootstrap() {
  loadAppConfig()
    .then(function() {
      return fetch('./src/fonts/optimer_regular.typeface.json');
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(fontData) {
      font = new THREE.Font(fontData);
      startApp();
    })
    .catch(function(error) {
      console.error('Unable to load font data:', error);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
