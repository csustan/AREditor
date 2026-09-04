/*
 * QRClient connects the main browser code to the QR-decoding Web Worker.
 *
 * The main application draws each camera frame onto an HTML canvas. QRClient
 * copies that canvas's pixels and sends them to qrworker.js for analysis. The
 * worker runs separately from the browser's main thread, so expensive QR-code
 * detection is less likely to pause animation, drawing, or user interaction.
 *
 * This file does not render graphics or calculate the model's 3D position. It
 * only moves image data to the decoder and returns the decoder's result.
 */

// This immediately invoked function expression (IIFE) creates a private scope.
// Variables declared inside it do not become accidental global variables.
// `global` receives the browser's `window` object at the bottom of the file.
(function(global) {
  /**
   * Create a reusable QR-code decoder client.
   *
   * Call this with `new QRClient()`. One worker is created for the client and
   * reused for every camera frame instead of creating a costly worker per frame.
   */
  function QRClient() {
    // A Web Worker executes qrworker.js away from the browser's main thread.
    // The leading slash makes this path relative to the web server's root.
    var worker = new Worker('/scripts/jsqrcode/qrworker.js');

    // Decoding is asynchronous: the answer arrives after `decode` has returned.
    // Save the caller's function here so `worker.onmessage` can call it later.
    // The application allows only one decode request at a time. If `decode` were
    // called again too early, this variable would be replaced by the new callback.
    var currentCallback;

    /**
     * Ask the worker to decode the pixels currently stored in a canvas.
     *
     * @param {CanvasRenderingContext2D} context
     *   The canvas's 2D drawing context. The main application has already drawn
     *   the latest video frame into this canvas before calling this method.
     * @param {string} trackMatchingQRCodeData
     *   The exact QR payload to accept. An empty string means the worker should
     *   use its normal first-detected QR-code behavior.
     * @param {Function} callback
    *   Called later with a decoded barcode object, or `undefined` when the
    *   worker cannot find an acceptable QR code in this frame. A successful
    *   object contains `rawValue` (the QR's text) and `cornerPoints` (pixel
    *   positions that main.js later uses to place the 3D model).
     */
      // Assigning a function to `this.decode` creates a public method on this
      // particular QRClient object, allowing callers to use `client.decode(...)`.
    this.decode = function(context, trackMatchingQRCodeData, callback) {
      // Remember who should receive the asynchronous result for this frame.
      currentCallback = callback;

      // A canvas is ultimately a grid of colored pixels. `getImageData` copies
      // the complete grid into an ImageData object containing width, height, and
      // RGBA byte values (red, green, blue, and alpha/transparency per pixel).
      var imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);

      try {
        // `postMessage` places a structured copy of this object in the worker's
        // message queue. The main thread continues instead of waiting for QR
        // detection to finish.
        worker.postMessage({
          imageData: imageData,

          // Treat a missing/falsy configuration value as the documented empty
          // string, which preserves the decoder's standard behavior.
          trackMatchingQRCodeData: trackMatchingQRCodeData || ''
        });
      } catch (err) {
        // This catches immediate message-sending failures, such as data that the
        // browser cannot copy to a worker. Decoder failures are handled inside
        // qrworker.js and are returned as an unsuccessful result instead.
        console.error(err);
      }
    };

    // The browser calls this event handler whenever qrworker.js uses postMessage
    // to return a result. `e.data` is the value sent by the worker.
    worker.onmessage = function(e) {
      // Guard the call in case a message somehow arrives before `decode` has
      // supplied a callback. Calling an undefined value would throw an error.
      if (currentCallback) {
        currentCallback(e.data);
      }
    };
  }

  // Deliberately expose only the constructor on `window`. Other variables in
  // this file stay private, while main.js can create `new window.QRClient()`.
  global.QRClient = QRClient;

// Pass the browser's global `window` object into the IIFE as `global`.
})(window);
