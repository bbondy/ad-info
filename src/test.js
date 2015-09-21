var fs = require('fs');
var page = require('webpage').create(),
    system = require('system');

var ABPFilterParser = require(fs.workingDirectory + '/lib/abp-filter-parser-commonjs');

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

    function getElementContentWidth(element) {
      var styles = window.getComputedStyle(element);
      var padding = parseFloat(styles.paddingLeft) +
        parseFloat(styles.paddingRight);
      return element.clientWidth - padding;
    }
    function getElementContentHeight(element) {
      var styles = window.getComputedStyle(element);
      var padding = parseFloat(styles.paddingTop) +
        parseFloat(styles.paddingBottom);
      return element.clientHeight - padding;
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
      var parentWidth = getElementContentWidth(node.parentNode);
      var parentHeight = getElementContentHeight(node.parentNode);
      if (!gptPlaceholder && (parentWidth !== width || parentHeight !== height)) {
        return node;
      }

      return getReplaceId(node.parentNode, width, height);
    }

    var iframes = document.querySelectorAll('iframe');
    var iframesData = [];
    for (var i = 0; i < iframes.length; i++) {
      var iframe = iframes[i];
      var width = getElementContentWidth(iframe);
      var height = getElementContentHeight(iframe);
      if (isSupportedAdSize(width, height)) {
        iframesData.push({
          //src: iframe.src,
          width: width,
          height: height,
          //top: rect.top,
          //left: rect.left,
          //name: iframe.name,
          //id: iframe.id,
          replaceId: getReplaceId(iframe, width, height).id
        });
      }
    }
    return iframesData;
  });

  console.log(iframesData.length);
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
    //console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
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
