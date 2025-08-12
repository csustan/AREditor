import {
  UIPanel, UIText, UIInput, UINumber, UIButton, UIRow
} from './libs/ui.js';

function SidebarMarkerGenerator(editor) {
  const container = new UIPanel();
  container.setId('sidebar-marker-generator');
  container.setPaddingTop('20px');

  let innerImageURL = null;
  let fullMarkerURL = null;
  let imageName = null;
  let selectedColor = 'black';

  // --- Upload Image Button ---
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    imageName = file.name.split('.').slice(0, -1).join('.') || file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      innerImageURL = e.target.result;
      updateFullMarkerImage();
    };
    reader.readAsDataURL(file);
  });

  const uploadButton = new UIButton('Upload Marker Image').onClick(() => {
    fileInput.click();
  });

  container.dom.appendChild(fileInput);
  container.add(uploadButton);

  // --- Preview Image ---
  const previewImage = document.createElement('img');
  previewImage.style.marginTop = '10px';
  previewImage.style.maxWidth = '100%';
  previewImage.style.border = '1px solid #444';
  previewImage.style.display = 'none';
  container.dom.appendChild(previewImage);

  // --- Pattern Ratio ---
  container.add(new UIText('Pattern Ratio:'));
  const patternRatio = new UINumber(0.5).setRange(0.1, 0.9).setStep(0.01).onChange(updateFullMarkerImage);
  container.add(patternRatio);

  // --- Image Size ---
  container.add(new UIText('Image Size (px):'));
  const imageSize = new UINumber(512).setRange(150, 2500).setStep(10).onChange(updateFullMarkerImage);
  container.add(imageSize);

  // --- Border Color Dropdown ---
  const colorOptions = [
    'black', 'white', 'red', 'green', 'blue',
    'yellow', 'orange', 'purple', 'pink', 'gray'
  ];

  const colorDropdown = new UIInput().setValue(selectedColor).onChange(() => {
    selectedColor = colorDropdown.getValue();
    updateFullMarkerImage();
  });

  const swatchRow = new UIRow();
  swatchRow.add(new UIText('Border Color:').setWidth('90px'));
  swatchRow.add(colorDropdown);
  container.add(swatchRow);

  const swatchRow2 = new UIRow();
  colorOptions.forEach(color => {
    const swatch = document.createElement('div');
    swatch.style.width = '20px';
    swatch.style.height = '20px';
    swatch.style.margin = '2px';
    swatch.style.border = '1px solid #888';
    swatch.style.borderRadius = '4px';
    swatch.style.background = color;
    swatch.style.cursor = 'pointer';
    swatch.title = color;
    swatch.onclick = () => {
      selectedColor = color;
      colorDropdown.setValue(color);
      updateFullMarkerImage();
    };
    swatchRow2.dom.appendChild(swatch);
  });
  container.add(swatchRow2);

  // --- Download Buttons ---
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

  // --- PDF Export Buttons ---
  const pdf1 = new UIButton('PDF One/Page').onClick(() => generatePDFLayout(1));
  const pdf2 = new UIButton('PDF Two/Page').onClick(() => generatePDFLayout(2));
  const pdf6 = new UIButton('PDF Six/Page').onClick(() => generatePDFLayout(6));

  container.add(pdf1);
  container.add(pdf2);
  container.add(pdf6);

  // --- Marker Generator Logic ---
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
      fullMarkerURL = markerUrl;
      previewImage.src = markerUrl;
      previewImage.style.display = 'block';
    });
  }

  function generatePDFLayout(countPerPage) {
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

  return container;
}

export { SidebarMarkerGenerator };
