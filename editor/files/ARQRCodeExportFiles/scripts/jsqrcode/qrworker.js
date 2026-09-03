// Self-contained software QR fallback (no node_modules) loaded from local files.
importScripts(
  'qrcode.js',
  'grid.js',
  'version.js',
  'detector.js',
  'formatinf.js',
  'errorlevel.js',
  'bitmat.js',
  'datamask.js',
  'bmparser.js',
  'databr.js',
  'rsdecoder.js',
  'gf256poly.js',
  'gf256.js',
  'decoder.js',
  'findpat.js',
  'alignpat.js',
  'datablock.js'
);

var barcodeDetector, barcodeDetectorErrored;

function decodeWithJsQR(imageData) {
  try {
    var code = qrcode.decodeWithPoints(imageData.width, imageData.height, imageData);
    postMessage(code || undefined);
  } catch (err) {
    postMessage(undefined);
  }
}

self.onmessage = function(e) {
  var data = e.data;

  if ('BarcodeDetector' in self && !barcodeDetectorErrored) {
    barcodeDetector = barcodeDetector || new BarcodeDetector({ formats: ['qr_code'] });

    barcodeDetector.detect(data)
    .then(function(barcodes) {
      if (barcodes.length > 0) {
        var bc = { rawValue: barcodes[0].rawValue, cornerPoints: barcodes[0].cornerPoints };
        postMessage(bc);
      } else {
        postMessage(undefined);
      }
    })
    .catch(function(err) {
      barcodeDetectorErrored = true;
      console.error('BarcodeDetector failed, falling back to jsQR:', err);
      decodeWithJsQR(data);
    });
  } else {
    decodeWithJsQR(data);
  }

};
