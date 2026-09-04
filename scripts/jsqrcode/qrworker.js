/*
 * This file runs inside a Web Worker, a background JavaScript environment that
 * is separate from the page's main thread. QR recognition can require scanning
 * many pixels and correcting damaged data, so doing that work here helps the
 * page continue rendering its camera view and 3D model smoothly.
 *
 * qrclient.js sends this worker an ImageData object for each camera frame. This
 * worker tries to decode a QR code and sends either a small barcode result or
 * `undefined` back. It prefers the browser's BarcodeDetector API because that
 * API can detect multiple QR codes. When the API is unavailable or fails, the
 * worker uses the older JavaScript decoder bundled below.
 *
 * Workers cannot directly access the page's HTML, canvas, or `window` object.
 * They communicate with the page only through messages.
 */

// `importScripts` synchronously loads classic JavaScript files into this worker.
// Paths are relative to qrworker.js. Together, these files form a self-contained
// software QR decoder, so the application does not need npm or an internet CDN.
// The files provide QR detection, perspective sampling, encoded-bit parsing,
// data masks, and Reed-Solomon error correction.
importScripts(
  'qrcode.js',    // Coordinates the software decoder and creates its result.
  'grid.js',      // Samples a corrected square grid from the photographed QR.
  'version.js',   // Describes the dimensions and features of QR versions.
  'detector.js',  // Finds QR geometry and corrects camera perspective.
  'formatinf.js', // Reads QR format information such as mask and error level.
  'errorlevel.js', // Defines the QR error-correction levels.
  'bitmat.js',    // Stores the QR's black/white modules as a bit matrix.
  'datamask.js',  // Removes the mask applied when the QR code was generated.
  'bmparser.js',  // Parses version, format, and codewords from the bit matrix.
  'databr.js',     // Reads corrected codewords into typed payload data.
  'rsdecoder.js', // Repairs damaged codewords with Reed-Solomon decoding.
  'gf256poly.js', // Provides polynomial math used by error correction.
  'gf256.js',     // Provides finite-field arithmetic used by those polynomials.
  'decoder.js',   // Converts the corrected QR matrix into payload bytes.
  'findpat.js',   // Locates the three large square finder patterns.
  'alignpat.js',  // Locates smaller alignment patterns on larger QR versions.
  'datablock.js'  // Organizes codewords into the QR's specified data blocks.
);

// Keep one native detector and reuse it between frames. Constructing a detector
// for every frame would create unnecessary objects and processing overhead.
// `barcodeDetectorErrored` starts as `undefined` (which behaves like false). If
// the native API fails once, it becomes true so later frames use the fallback
// directly rather than repeatedly triggering the same failed native operation.
var barcodeDetector, barcodeDetectorErrored;

/**
 * Choose the native BarcodeDetector result that the application should track.
 *
 * @param {Array} barcodes
 *   Every QR code found by the native detector in the current camera frame.
 * @param {string} trackMatchingQRCodeData
 *   An exact QR payload to require, or an empty string to preserve the original
 *   first-result behavior.
 * @returns {Object|undefined}
 *   The selected barcode, or `undefined` when there is no acceptable result.
 */
function selectBarcode(barcodes, trackMatchingQRCodeData) {
  // Declare the loop counter once because this code follows older JavaScript
  // syntax for compatibility with the legacy decoder files.
  var i;

  // Stop immediately when the detector found nothing. A bare `return` produces
  // JavaScript's `undefined` value, which means "no usable QR code" in this app.
  if (!barcodes || barcodes.length === 0) {
    return;
  }

  // An empty configured value disables payload filtering. BarcodeDetector does
  // not promise that item zero is physically closest, only that it is the first
  // item in the API's results, so this exactly preserves the behavior from before
  // the QRCode filter process was added in -- this is impotant to have so the 
  // program runs even when the programmer decides not to use the filter.
  if (trackMatchingQRCodeData === '') {
    return barcodes[0];
  }

  // Check all native results because the desired code may not be the first one.
  // `===` performs an exact, case-sensitive comparison without type conversion.
  for (i = 0; i < barcodes.length; i++) {
    if (barcodes[i].rawValue === trackMatchingQRCodeData) {
      // Returning immediately ends the loop as soon as the match is found.
      return barcodes[i];
    }
  }

  // If the loop ends without returning, JavaScript implicitly returns
  // `undefined`, telling the caller that none of the visible QR codes matched.
}

/**
 * Decode one frame with the bundled JavaScript fallback library.
 *
 * Unlike the native API, this decoder returns at most one QR candidate. It can
 * reject a decoded candidate whose text is wrong, but it cannot then search the
 * same frame for a different matching QR code.
 *
 * @param {ImageData} imageData The camera-frame pixels copied from the canvas.
 * @param {string} trackMatchingQRCodeData Exact required payload, or "".
 */
function decodeWithJsQR(imageData, trackMatchingQRCodeData) {
  // The bundled decoder is synchronous and reports many ordinary decode
  // failures by throwing, so protect the worker with try/catch.
  try {
    // Width and height describe how the flat RGBA pixel array forms an image.
    // `decodeWithPoints` returns both the text and corners needed for 3D pose.
    var code = qrcode.decodeWithPoints(imageData.width, imageData.height, imageData);

    // When filtering is enabled, discard the fallback's single result unless
    // its decoded text exactly matches the configured text.
    if (code && trackMatchingQRCodeData !== '' && code.rawValue !== trackMatchingQRCodeData) {
      code = undefined;
    }

    // Send the accepted result back to qrclient.js. `code || undefined` converts
    // any empty/falsy result into the app's standard "nothing detected" value.
    postMessage(code || undefined);
  } catch (err) {
    // A frame with an unreadable QR code is expected during live video, so
    // report no result rather than allowing the worker to stop with an error.
    postMessage(undefined);
  }
}

// `self` is the worker's global object, similar to `window` on the web page.
// The browser calls this handler whenever qrclient.js sends a frame.
self.onmessage = function(e) {
  // `e.data` is the structured message object created in QRClient.decode().
  var request = e.data;

  // ImageData contains the camera frame's dimensions and RGBA pixel bytes.
  var imageData = request.imageData;

  // Accept only a real string as the matching rule. Invalid or missing config
  // becomes an empty string, which safely restores unfiltered behavior.
  var trackMatchingQRCodeData = typeof request.trackMatchingQRCodeData === 'string'
    ? request.trackMatchingQRCodeData
    : '';

  // Feature detection checks whether this browser exposes BarcodeDetector in
  // the worker. Also skip it after a previous native failure in this session.
  if ('BarcodeDetector' in self && !barcodeDetectorErrored) {
    // `||` lazily creates the detector only on its first use. Restricting formats
    // to QR codes avoids asking the browser to look for unrelated barcode types.
    barcodeDetector = barcodeDetector || new BarcodeDetector({ formats: ['qr_code'] });

    // Native detection is asynchronous and returns a Promise. The worker can
    // remain responsive while the browser's detector processes the pixels.
    barcodeDetector.detect(imageData)
    .then(function(barcodes) {
      // The resolved array can contain several visible QR codes. Apply the
      // optional exact-payload rule before returning any geometry to the page.
      var selectedBarcode = selectBarcode(barcodes, trackMatchingQRCodeData);
      if (selectedBarcode) {
        // Return only the fields the rest of this application needs: decoded
        // text and four image-space corners used to calculate the model's pose.
        var bc = { rawValue: selectedBarcode.rawValue, cornerPoints: selectedBarcode.cornerPoints };
        postMessage(bc);
      } else {
        // No QR code, or no matching QR code, was found in this frame.
        postMessage(undefined);
      }
    })
    .catch(function(err) {
      // A rejected Promise means the browser's native detector failed rather
      // than merely finding zero codes. Remember that failure, log it for
      // diagnostics, and still try to decode this frame with the local library.
      barcodeDetectorErrored = true;
      console.error('BarcodeDetector failed, falling back to jsQR:', err);
      decodeWithJsQR(imageData, trackMatchingQRCodeData);
    });
  } else {
    // Use the bundled decoder when BarcodeDetector is unsupported or previously
    // failed. This branch works without network access or external packages.
    decodeWithJsQR(imageData, trackMatchingQRCodeData);
  }

  // There is no synchronous return value from a message handler. Results travel
  // back later through `postMessage`, which triggers QRClient's onmessage handler.
};
