var page = require('webpage').create(),
    system = require('system'),
    t, url;

function onPageReady() {
  var htmlContent = page.evaluate(function () {
    return document.querySelectorAll('iframe').length;
    // return document.documentElement.outerHTML;
  });

  console.log(htmlContent);
  phantom.exit();
}

if (system.args.length === 1) {
    console.log('Usage: test.js <some URL>');
    phantom.exit(1);
} else {
  t = Date.now();
  url = system.args[1];
  page.open(url, function (status) {
    function checkReadyState() {
      setTimeout(function () {
        var readyState = page.evaluate(function () {
          return document.readyState;
        });

        if ("complete" === readyState) {
          onPageReady();
        } else {
          checkReadyState();
        }
      });
    }
    checkReadyState();
  });
}


