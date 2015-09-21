var fs = require('fs');
var page = require('webpage').create(),
    system = require('system');

var ABPFilterParser = require(fs.workingDirectory + '/lib/abp-filter-parser-commonjs');
console.log(ABPFilterParser);

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
  }, 12000);
}

function pageLoadDone() {
  var iframesData = page.evaluate(function () {
    function isSupportedAdSize(width, height) {
      return width === 728 && height === 90 ||
        width === 300 && height === 250 ||
        width === 160 && height === 600 ||
        width === 320 && height === 50;
    }


    // Gets the top most parent ID with the same dimensions as the
    // passed in node
    function getReplaceId(node, width, height) {
      if (!node.parentNode) {
        return node;
      }

      if (!node.parentNode.id) {
        return node;
      }

      // TODO: Check against abp-filter html rules instead
      var gptPlaceholder = node.parentNode.id.indexOf('gpt-ad-') !== -1;
      var rect = node.parentNode.getBoundingClientRect();
      if (!gptPlaceholder && (rect.width !== width || rect.height !== height)) {
        return node;
      }

      return getReplaceId(node.parentNode, width, height);
    }

    var iframes = document.querySelectorAll('iframe');
    var iframesData = [];
    for (var i = 0; i < iframes.length; i++) {
      var iframe = iframes[i];
      var rect = iframe.getBoundingClientRect();
      if (isSupportedAdSize(rect.width, rect.height)) {
        iframesData.push({
          //src: iframe.src,
          width: rect.width,
          height: rect.height,
          //top: rect.top,
          //left: rect.left,
          //name: iframe.name,
          //id: iframe.id,
          replaceId: getReplaceId(iframe, rect.width, rect.height).id
        });
      }
    }
    return iframesData;
  });

  console.log(JSON.stringify(iframesData));
  /*
  for (var i = 0; i < iframesData.length; i++) {
    var iframeData = iframesData[i];
    //console.log(JSON.stringify(iframeData));
    console.log(iframeData);
  }
  */
  phantom.exit();
}

if (system.args.length === 1) {
  console.log('Usage: test.js <some URL>');
  phantom.exit(1);
}


function main() {
  var url = system.args[1];
  page.onConsoleMessage = function(msg, lineNum, sourceId) {
    console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
  };
  page.onError = function(msg, trace) {
    var msgStack = ['ERROR: ' + msg];
    if (trace && trace.length) {
      msgStack.push('TRACE:');
      trace.forEach(function(t) {
        msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
      });
    }
    console.error(msgStack.join('\n'));
  };

  page.open(url, function (status) {
    checkReadyState(pageLoadDone);
  });
}

main();
