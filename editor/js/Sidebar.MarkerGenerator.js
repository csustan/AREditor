import {
  UIPanel, UIText, UIInput, UINumber, UIButton, UIRow
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

  const container = new UIPanel();
  container.setId('sidebar-marker-generator');
  container.setPaddingTop('20px');

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.position = 'absolute';
  fileInput.style.left = '-9999px';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    imageName = file.name.split('.').slice(0, -1).join('.') || file.name;

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

  const uploadButton = new UIButton('Upload Marker Image').onClick(() => fileInput.click());
  container.add(uploadButton);

  const previewImage = document.createElement('img');
  previewImage.style.marginTop = '10px';
  previewImage.style.maxWidth = '100%';
  previewImage.style.border = '1px solid #444';
  previewImage.style.display = 'none';
  container.dom.appendChild(previewImage);
  window._markerPreviewImage = previewImage;

  container.add(new UIText('Pattern Ratio:'));
  const patternRatio = new UINumber(0.5).setRange(0.1, 0.9).setStep(0.01).onChange(updateFullMarkerImage);
  container.add(patternRatio);
  window._markerPatternRatio = patternRatio;

  container.add(new UIText('Image Size (px):'));
  const imageSize = new UINumber(512).setRange(150, 2500).setStep(10).onChange(updateFullMarkerImage);
  container.add(imageSize);
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

  container.add(downloadPattern);
  container.add(downloadImage);

  const pdf1 = new UIButton('PDF One/Page').onClick(async () => await generatePDFLayout(1));
  const pdf2 = new UIButton('PDF Two/Page').onClick(async () => await generatePDFLayout(2));
  const pdf6 = new UIButton('PDF Six/Page').onClick(async () => await generatePDFLayout(6));
  container.add(pdf1);
  container.add(pdf2);
  container.add(pdf6);

  const resetButton = new UIButton('Reset to Default Marker').onClick(async () => {
    innerImageURL = defaultMarkerURL;
    imageName = 'default-marker';
    fullMarkerURL = null; // Force regenerate on reset
    updateFullMarkerImage();
    await window.generateMarkerImage();
    await window.generateMarkerPattern();
  });

  container.add(resetButton);

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
  updateFullMarkerImage();

  return container;
}

export { SidebarMarkerGenerator };
