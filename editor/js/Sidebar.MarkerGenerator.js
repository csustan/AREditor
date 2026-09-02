import {
  UISpan, UIText, UIInput, UISelect, UICheckbox, UINumber, UIButton, UIRow, UIHorizontalRule
} from './libs/ui.js';

//This will generate a Canvas Element that will work as a fall back wor whn the images won't load.
//It's returned as a URL to be compatible with the rest of the code.
function generateFallbackRedSwatch() {
  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Red background
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(0, 0, size, size);

  // White X
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 40;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(60, 60);
  ctx.lineTo(size - 60, size - 60);
  ctx.moveTo(size - 60, 60);
  ctx.lineTo(60, size - 60);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}


// --- Shared marker state (used by UI and global functions) ---
let innerImageURL = null;
let fullMarkerURL = null;
let imageName = null;
let selectedColor = 'black';
const defaultMarkerURL = 'files/LargeLambdaSymbol.png'; //Test Code
//const defaultMarkerURL = generateFallbackRedSwatch(); //Utlize the default

// Defaults match Menubar.File.js and the exported APP.js template.
const AR_MARKER_APP_EXPORT_DEFAULTS = {
  camera: {
    fov: 70,
    near: 0.05,
    far: 1000
  },
  arToolkitSource: {
    sourceType: 'webcam'
  },
  arToolkitContext: {
    cameraParametersUrl: './js/data/camera_para.dat',
    detectionMode: 'mono'
  },
  arMarkerControls: {
    type: 'pattern',
    patternUrl: './js/data/lambda.patt',
    smooth: true,
    smoothCount: 5,
    smoothTolerance: 0.01,
    smoothThreshold: 2
  }
};

// Set true while developing to show the Advanced AR Settings panel; leave false for release builds.
const SHOW_ADVANCED_AR_SETTINGS = false;

// --- Shared exported pattern/image state for zip building ---
let sharedMarkerPattern = null;
let sharedMarkerImageDataURL = null;

// Export state accessors globally
window.getSharedMarkerPattern = () => sharedMarkerPattern;
window.getSharedMarkerImageDataURL = () => sharedMarkerImageDataURL;

//Update the marker generator preview image whenever a new marker image is generated.
function updateMarkerPreviewImage(markerUrl) {
  if (!window._markerPreviewImage) return;

  const img = window._markerPreviewImage;
  img.src = '';
  requestAnimationFrame(() => {
    img.src = markerUrl;
    img.style.display = 'block';
  });
}

//If the default template marker plane exists in the scene, update its material to match the current generated marker image.
function syncDefaultMarkerPlaneTexture(markerUrl) {
  const editor = window._editor;
  const markerPlane = editor?.scene?.getObjectByName?.('DefaultMarkerPlaneForScale'); //Look for the default marker plane in the current editor scene.

  if (!markerPlane || !markerPlane.material) return; //Stop here if the default marker plane is not present or does not have a material yet.

  const textureLoader = new window.THREE.TextureLoader(); //Create a texture loader so the generated marker image can be loaded into the plane material.
  textureLoader.load(markerUrl, (texture) => { //Load the current generated marker image from its URL.
    markerPlane.material.map = texture; //Assign the loaded texture to the default marker plane material.
    markerPlane.material.needsUpdate = true; //Flag the material so Three.js redraws it with the new texture.
    editor.signals.objectChanged.dispatch(markerPlane); //Notify the editor that the marker plane object has changed.
    editor.signals.materialChanged.dispatch(markerPlane.material); //Notify the editor that the marker plane material has changed.
    editor.signals.sceneGraphChanged.dispatch(); //Refresh the scene graph so the editor UI stays in sync.
  });
}

//Keep the generated marker image in one place so the preview image, shared export state, and default template plane all stay synchronized.
function applyGeneratedMarkerImage(markerUrl) {
  fullMarkerURL = markerUrl;
  sharedMarkerImageDataURL = markerUrl;
  updateMarkerPreviewImage(markerUrl);
  syncDefaultMarkerPlaneTexture(markerUrl);
}

// --- Global Generator Functions (used by Menubar.File.js) ---
	window.generateMarkerImage = async function generateMarkerImage() {
	  return new Promise((resolve) => {
	    const fallbackImage = extractSceneBackgroundAsDataURL();
	    const imageSource = innerImageURL || fallbackImage;

    const ratio = window._markerPatternRatio?.getValue?.() ?? 0.5;
    const size = window._markerImageSize?.getValue?.() ?? 512;
    const color = selectedColor;

	    THREEx.ArPatternFile.buildFullMarker(imageSource, ratio, size, color, (markerUrl) => {
	      applyGeneratedMarkerImage(markerUrl);
	      console.log('[Generator] Marker image (with border) generated.');
	      resolve();
	    });
	  });
	};

	window.generateMarkerPattern = async function generateMarkerPattern() {
	  return new Promise((resolve) => {
	    const fallbackImage = extractSceneBackgroundAsDataURL();
	    const imageSource = innerImageURL || fallbackImage;

	    THREEx.ArPatternFile.encodeImageURL(imageSource, (patternFileString) => {
	      sharedMarkerPattern = patternFileString;
	      console.log('[Generator] Marker pattern (no border) generated.');
	      resolve();
	    });
	  });
	};

// --- Utility: extract fallback background image ---
function extractSceneBackgroundAsDataURL() {
  const bg = window._editor?.scene?.background;
  if (!bg || !bg.image) {
    console.warn('[Marker Generator] No scene background. Using default.');
    return defaultMarkerURL;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = bg.image.width || 512;
    canvas.height = bg.image.height || 512;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bg.image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('[Marker Generator] Failed to extract background:', e);
    return defaultMarkerURL;
  }
}

// --- Main UI Component ---
function SidebarMarkerGenerator(editor) {
  // Store editor globally so global funcs can access it
  window._editor = editor;

  const config = editor.config;

  const container = new UISpan();
  container.setId('sidebar-marker-generator');
  container.dom.style.display = 'block';
  container.dom.style.width = '100%';
  container.dom.style.boxSizing = 'border-box';

  const content = new UISpan();
  content.dom.style.display = 'block';
  content.dom.style.width = '100%';
  content.dom.style.boxSizing = 'border-box';
  content.dom.style.paddingLeft = '14px';
  content.dom.style.paddingRight = '10px';
  content.dom.style.paddingTop = '20px';
  container.add(content);

  function getConfigString(key, fallback) {
    const value = config.getKey(key);
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
  }

  function getConfigNumber(key, fallback) {
    const number = Number(config.getKey(key));
    return Number.isFinite(number) ? number : fallback;
  }

  function getConfigBoolean(key, fallback) {
    const value = config.getKey(key);
    return typeof value === 'boolean' ? value : fallback;
  }

  function makeSectionTitle(text) {
    const title = new UIText(text);
    title.setFontSize('13px');
    title.setMarginBottom('8px');
    title.dom.style.display = 'block';
    return title;
  }

  function makeSettingRow(labelText, control, labelWidth = '110px') {
    const row = new UIRow();
    row.setMarginBottom('8px');
    row.dom.style.display = 'flex';
    row.dom.style.flexWrap = 'wrap';
    row.dom.style.alignItems = 'center';
    row.dom.style.gap = '6px';
    row.add(new UIText(labelText).setWidth(labelWidth));
    row.add(control);
    content.add(row);
    return row;
  }

  function makeNumberSetting(labelText, key, fallback, options = {}) {
    const control = new UINumber();
    control.setPrecision(options.precision ?? 2);
    control.setRange(options.min ?? -Infinity, options.max ?? Infinity);
    control.setStep(options.step ?? 1);
    control.setWidth(options.width ?? '90px');
    control.setValue(getConfigNumber(key, fallback));
    control.onChange(() => config.setKey(key, control.getValue()));
    makeSettingRow(labelText, control, options.labelWidth);
    return control;
  }

  function makeTextSetting(labelText, key, fallback, options = {}) {
    const control = new UIInput();
    control.setWidth(options.width ?? '170px');
    control.setValue(getConfigString(key, fallback));
    control.onChange(() => config.setKey(key, control.getValue()));
    makeSettingRow(labelText, control, options.labelWidth);
    return control;
  }

  function makeSelectSetting(labelText, key, fallback, options, rowOptions = {}) {
    const control = new UISelect();
    control.setWidth(rowOptions.width ?? '170px');
    control.setOptions(options);
    control.setValue(getConfigString(key, fallback));
    control.onChange(() => config.setKey(key, control.getValue()));
    makeSettingRow(labelText, control, rowOptions.labelWidth);
    return control;
  }

  function makeCheckboxSetting(labelText, key, fallback, options = {}) {
    const control = new UICheckbox(getConfigBoolean(key, fallback));
    control.onChange(() => config.setKey(key, control.getValue()));
    makeSettingRow(labelText, control, options.labelWidth);
    return control;
  }

  const header = new UIText('AR Marker Generator');
  header.setFontSize('14px');
  header.setMarginBottom('8px');
  header.dom.style.display = 'block';
  content.add(header);

  const fileStatusText = new UIText('Using scene background.');
  fileStatusText.setColor('#888');
  fileStatusText.setMarginBottom('6px');
  fileStatusText.dom.style.display = 'block';
  content.add(fileStatusText);

  const fileSection = new UISpan();
  fileSection.dom.style.display = 'block';
  fileSection.dom.style.marginBottom = '8px';

  const imageLabel = new UIText('Image');
  imageLabel.dom.style.display = 'block';
  imageLabel.dom.style.marginBottom = '6px';
  fileSection.add(imageLabel);

  const previewImage = document.createElement('img');
  previewImage.style.maxWidth = '100%';
  previewImage.style.display = 'none';
  previewImage.style.marginBottom = '8px';
  previewImage.style.border = '1px solid #444';
  fileSection.dom.appendChild(previewImage);
  window._markerPreviewImage = previewImage;

  const chooseFileRow = new UIRow();
  chooseFileRow.dom.style.display = 'flex';
  chooseFileRow.dom.style.alignItems = 'center';
  chooseFileRow.dom.style.gap = '8px';
  chooseFileRow.setMarginBottom('6px');

  const chooseFileButton = new UIButton('Choose File');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  chooseFileButton.onClick(() => fileInput.click());

  chooseFileRow.add(chooseFileButton);
  chooseFileRow.dom.appendChild(fileInput);
  fileSection.add(chooseFileRow);

  const chosenFileNameText = new UIText('No file chosen');
  chosenFileNameText.setColor('#888');
  chosenFileNameText.dom.style.display = 'block';
  fileSection.add(chosenFileNameText);

  content.add(fileSection);

  const statusText = new UIText('Marker preview updates automatically.');
  statusText.setColor('#888');
  statusText.setMarginBottom('8px');
  statusText.dom.style.display = 'block';
  content.add(statusText);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    imageName = file.name.split('.').slice(0, -1).join('.') || file.name;
    chosenFileNameText.setValue(file.name);
    fileStatusText.setValue('Custom marker image loaded.');

    const reader = new FileReader();

    reader.onload = async (e) => {
      innerImageURL = e.target.result;
      fullMarkerURL = null; // force regenerate even if the same image -
      //- wihtout this, resetting the image then importing would cause the image preview not to refresh
      updateFullMarkerImage();
    
      //Automatically regenerate pattern
      await window.generateMarkerImage();
      await window.generateMarkerPattern();


      //Clear input value to allow re-uploading the same file uploaded before without bugging out.
      fileInput.value = '';

    };

    reader.readAsDataURL(file);

  });

  content.add(makeSectionTitle('Marker Image Settings'));

  const patternRatio = new UINumber(0.5).setRange(0.1, 0.9).setStep(0.01).onChange(updateFullMarkerImage);
  makeSettingRow('Pattern Ratio', patternRatio);
  window._markerPatternRatio = patternRatio;

  const imageSize = new UINumber(512).setRange(150, 2500).setStep(10).onChange(updateFullMarkerImage);
  makeSettingRow('Image Size (px)', imageSize);
  window._markerImageSize = imageSize;

  const colorDropdown = new UIInput().setValue(selectedColor).onChange(() => {
    selectedColor = colorDropdown.getValue();
    updateFullMarkerImage();
  });

  
  // //Disabling the Color Change option for now.
  // const swatchRow = new UIRow();
  // swatchRow.add(new UIText('Border Color:').setWidth('90px'));
  // swatchRow.add(colorDropdown);
  // container.add(swatchRow);

  // const swatchRow2 = new UIRow();
  // ['black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray'].forEach(color => {
  //   const swatch = document.createElement('div');
  //   swatch.style.width = '20px';
  //   swatch.style.height = '20px';
  //   swatch.style.margin = '2px';
  //   swatch.style.border = '1px solid #888';
  //   swatch.style.borderRadius = '4px';
  //   swatch.style.background = color;
  //   swatch.style.cursor = 'pointer';
  //   swatch.title = color;
  //   swatch.onclick = () => {
  //     selectedColor = color;
  //     colorDropdown.setValue(color);
  //     updateFullMarkerImage();
  //   };
  //   swatchRow2.dom.appendChild(swatch);
  // });
  // container.add(swatchRow2);
  
  const downloadRow = new UIRow();
  downloadRow.setMarginBottom('8px');
  downloadRow.dom.style.display = 'flex';
  downloadRow.dom.style.flexWrap = 'wrap';
  downloadRow.dom.style.gap = '6px';

  const downloadPattern = new UIButton('Download Marker (.patt)').onClick(() => {
    if (!innerImageURL) return alert('Upload a file first');
    THREEx.ArPatternFile.encodeImageURL(innerImageURL, (patternFileString) => {
      THREEx.ArPatternFile.triggerDownload(patternFileString, `pattern-${imageName || 'marker'}.patt`);
    });
  });

  const downloadImage = new UIButton('Download Image').onClick(() => {
    if (!innerImageURL) return alert('Upload a file first');
    const a = document.createElement('a');
    a.href = fullMarkerURL;
    a.download = `pattern-${imageName || 'marker'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  downloadRow.add(downloadPattern);
  downloadRow.add(downloadImage);
  content.add(downloadRow);

  const pdfRow = new UIRow();
  pdfRow.setMarginBottom('8px');
  pdfRow.dom.style.display = 'flex';
  pdfRow.dom.style.flexWrap = 'wrap';
  pdfRow.dom.style.gap = '6px';
  const pdf1 = new UIButton('PDF One/Page').onClick(async () => await generatePDFLayout(1));
  const pdf2 = new UIButton('PDF Two/Page').onClick(async () => await generatePDFLayout(2));
  const pdf6 = new UIButton('PDF Six/Page').onClick(async () => await generatePDFLayout(6));
  pdfRow.add(pdf1);
  pdfRow.add(pdf2);
  pdfRow.add(pdf6);
  content.add(pdfRow);

  const resetButton = new UIButton('Reset to Default Marker').onClick(async () => {
    innerImageURL = defaultMarkerURL;
    imageName = 'default-marker';
    chosenFileNameText.setValue('Default marker');
    fileStatusText.setValue('Default marker image loaded.');
    fullMarkerURL = null; // Force regenerate on reset
    updateFullMarkerImage();
    await window.generateMarkerImage();
    await window.generateMarkerPattern();
  });
  resetButton.setMarginBottom('10px');

  content.add(resetButton);

  content.add(new UIHorizontalRule());
  content.add(makeSectionTitle('Export Runtime Settings'));

  const runtimeControls = {
    cameraFov: makeNumberSetting('Camera FOV', 'project/arMarkerApp/camera/fov', AR_MARKER_APP_EXPORT_DEFAULTS.camera.fov, {
      min: 1,
      max: 179,
      step: 1,
      precision: 0
    }),
    cameraNear: makeNumberSetting('Camera Near', 'project/arMarkerApp/camera/near', AR_MARKER_APP_EXPORT_DEFAULTS.camera.near, {
      min: 0.001,
      max: 1000,
      step: 0.01,
      precision: 3
    }),
    cameraFar: makeNumberSetting('Camera Far', 'project/arMarkerApp/camera/far', AR_MARKER_APP_EXPORT_DEFAULTS.camera.far, {
      min: 0.01,
      max: 100000,
      step: 10,
      precision: 2
    }),
    smooth: makeCheckboxSetting('Smoothing', 'project/arMarkerApp/marker/smooth', AR_MARKER_APP_EXPORT_DEFAULTS.arMarkerControls.smooth),
    smoothCount: makeNumberSetting('Smooth Count', 'project/arMarkerApp/marker/smoothCount', AR_MARKER_APP_EXPORT_DEFAULTS.arMarkerControls.smoothCount, {
      min: 1,
      max: 100,
      step: 1,
      precision: 0
    }),
    smoothTolerance: makeNumberSetting('Smooth Tolerance', 'project/arMarkerApp/marker/smoothTolerance', AR_MARKER_APP_EXPORT_DEFAULTS.arMarkerControls.smoothTolerance, {
      min: 0,
      max: 10,
      step: 0.01,
      precision: 4
    }),
    smoothThreshold: makeNumberSetting('Smooth Threshold', 'project/arMarkerApp/marker/smoothThreshold', AR_MARKER_APP_EXPORT_DEFAULTS.arMarkerControls.smoothThreshold, {
      min: 0,
      max: 100,
      step: 1,
      precision: 0
    })
  };

  content.add(new UIHorizontalRule());
  if (SHOW_ADVANCED_AR_SETTINGS) {
    content.add(makeSectionTitle('Advanced AR Settings'));

    runtimeControls.sourceType = makeSelectSetting('Source Type', 'project/arMarkerApp/source/sourceType', AR_MARKER_APP_EXPORT_DEFAULTS.arToolkitSource.sourceType, {
      webcam: 'webcam',
      image: 'image',
      video: 'video'
    });
    runtimeControls.cameraParametersUrl = makeTextSetting('Camera Params', 'project/arMarkerApp/context/cameraParametersUrl', AR_MARKER_APP_EXPORT_DEFAULTS.arToolkitContext.cameraParametersUrl);
    runtimeControls.detectionMode = makeSelectSetting('Detection Mode', 'project/arMarkerApp/context/detectionMode', AR_MARKER_APP_EXPORT_DEFAULTS.arToolkitContext.detectionMode, {
      mono: 'mono',
      color: 'color',
      mono_and_matrix: 'mono_and_matrix',
      color_and_matrix: 'color_and_matrix'
    });
    runtimeControls.markerType = makeSelectSetting('Marker Type', 'project/arMarkerApp/marker/type', AR_MARKER_APP_EXPORT_DEFAULTS.arMarkerControls.type, {
      pattern: 'pattern',
      barcode: 'barcode',
      unknown: 'unknown'
    });
    runtimeControls.patternUrl = makeTextSetting('Pattern URL', 'project/arMarkerApp/marker/patternUrl', AR_MARKER_APP_EXPORT_DEFAULTS.arMarkerControls.patternUrl);

    const resetRuntimeSettingsButton = new UIButton('Reset Export Settings').onClick(() => {
      const defaults = AR_MARKER_APP_EXPORT_DEFAULTS;

      runtimeControls.cameraFov.setValue(defaults.camera.fov);
      runtimeControls.cameraNear.setValue(defaults.camera.near);
      runtimeControls.cameraFar.setValue(defaults.camera.far);
      runtimeControls.smooth.setValue(defaults.arMarkerControls.smooth);
      runtimeControls.smoothCount.setValue(defaults.arMarkerControls.smoothCount);
      runtimeControls.smoothTolerance.setValue(defaults.arMarkerControls.smoothTolerance);
      runtimeControls.smoothThreshold.setValue(defaults.arMarkerControls.smoothThreshold);
      runtimeControls.sourceType.setValue(defaults.arToolkitSource.sourceType);
      runtimeControls.cameraParametersUrl.setValue(defaults.arToolkitContext.cameraParametersUrl);
      runtimeControls.detectionMode.setValue(defaults.arToolkitContext.detectionMode);
      runtimeControls.markerType.setValue(defaults.arMarkerControls.type);
      runtimeControls.patternUrl.setValue(defaults.arMarkerControls.patternUrl);

      config.setKey(
        'project/arMarkerApp/camera/fov', defaults.camera.fov,
        'project/arMarkerApp/camera/near', defaults.camera.near,
        'project/arMarkerApp/camera/far', defaults.camera.far,
        'project/arMarkerApp/marker/smooth', defaults.arMarkerControls.smooth,
        'project/arMarkerApp/marker/smoothCount', defaults.arMarkerControls.smoothCount,
        'project/arMarkerApp/marker/smoothTolerance', defaults.arMarkerControls.smoothTolerance,
        'project/arMarkerApp/marker/smoothThreshold', defaults.arMarkerControls.smoothThreshold,
        'project/arMarkerApp/source/sourceType', defaults.arToolkitSource.sourceType,
        'project/arMarkerApp/context/cameraParametersUrl', defaults.arToolkitContext.cameraParametersUrl,
        'project/arMarkerApp/context/detectionMode', defaults.arToolkitContext.detectionMode,
        'project/arMarkerApp/marker/type', defaults.arMarkerControls.type,
        'project/arMarkerApp/marker/patternUrl', defaults.arMarkerControls.patternUrl
      );
    });
    resetRuntimeSettingsButton.setMarginBottom('10px');
    content.add(resetRuntimeSettingsButton);
  }

  // //Set Pattern is only needed for testing.
  // const setPatternButton = new UIButton('Set Pattern').onClick(async () => {
  //   await window.generateMarkerImage();
  //   await window.generateMarkerPattern();
  // });
  //
  // container.add(setPatternButton);

  function updateFullMarkerImage() {
    if (!innerImageURL) return;

    const ratio = patternRatio.getValue();
    const size = imageSize.getValue();
    const color = selectedColor;

    console.log('[Marker Generator] Updating marker with:', {
      imageName,
      ratio,
      size,
      color,
      hasImage: !!innerImageURL
    });

    THREEx.ArPatternFile.buildFullMarker(innerImageURL, ratio, size, color, (markerUrl) => {
      applyGeneratedMarkerImage(markerUrl);
    });
  }

  async function generatePDFLayout(countPerPage) {
    await window.generateMarkerImage();

    if (!fullMarkerURL) return alert('Generate a marker first');

    const sizes = { 1: 600, 2: 300, 6: 250 };
    const docDefinition = { content: [] };
    const w = sizes[countPerPage];
    const row = () => [{ image: fullMarkerURL, width: w }, { image: fullMarkerURL, width: w }];

    if (countPerPage === 1) {
      docDefinition.content.push({ image: fullMarkerURL, width: w, alignment: 'center' });
    } else if (countPerPage === 2) {
      docDefinition.content.push(...row());
    } else {
      docDefinition.content.push(...[row(), row(), row()]);
    }

    pdfMake.createPdf(docDefinition).open();
  }

  // Initial marker
  innerImageURL = extractSceneBackgroundAsDataURL();
  imageName = 'scene-background';
  chosenFileNameText.setValue('Scene background');
  updateFullMarkerImage();

  return container;
}

export { SidebarMarkerGenerator };
