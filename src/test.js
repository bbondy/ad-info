var page = require('webpage').create(),
    system = require('system'),
    t, url;

function checkReadyState(done) {
  setTimeout(function () {
    var readyState = page.evaluate(function () {
      return document.readyState;
    });

    if ("complete" === readyState) {
      done();
    } else {
      checkReadyState(done);
    }
  }, 15000);
}

function pageLoadDone() {
  var htmlContent = page.evaluate(function () {
    function isSupportedAdSize(width, height) {
      return width === 728 && height === 90 ||
        width === 300 && height === 250 ||
        width === 160 && height === 600 ||
        width === 320 && height === 50;
    }

    var iframes = document.querySelectorAll('iframe');
    var iframeSrcs = [];
    for (var i = 0; i < iframes.length; i++) {
      var iframe = iframes[i];
      if (isSupportedAdSize(iframe.clientWidth, iframe.clientHeight)) {
        iframeSrcs.push(iframe.src);
      }
    }
    return iframeSrcs;
  });

  console.log(htmlContent.length);
  phantom.exit();
}

if (system.args.length === 1) {
    console.log('Usage: test.js <some URL>');
    phantom.exit(1);
} else {
  t = Date.now();
  url = system.args[1];
  page.open(url, function (status) {
    checkReadyState(pageLoadDone);
  });
}
