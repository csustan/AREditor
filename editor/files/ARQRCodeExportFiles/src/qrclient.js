(function(global) {
  function QRClient() {
    var worker = new Worker('/scripts/jsqrcode/qrworker.js');
    var currentCallback;

    this.decode = function(context, callback) {
      currentCallback = callback;
      var imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);

      try {
        worker.postMessage(imageData);
      } catch (err) {
        console.error(err);
      }
    };

    worker.onmessage = function(e) {
      if (currentCallback) {
        currentCallback(e.data);
      }
    };
  }

  global.QRClient = QRClient;
})(window);
