(function (global, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports'], factory);
  } else if (typeof exports !== 'undefined') {
    factory(exports);
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports);
    global.main = mod.exports;
  }
})(this, function (exports) {
  'use strict';

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  exports.init = init;
  exports.exit = exit;
  exports.getAdInfo = getAdInfo;
  var phantom = require('node-slimer');
  //var ABPFilterParser = require('abp-filter-parser');
  var slimer;

  var slimerjs = require('slimerjs');
  var binPath = slimerjs.path;

  function init() {
    return new Promise(function (resolve, reject) {
      phantom.create(function (err, sl) {
        slimer = sl;
        if (err) {
          console.error('init error:', err);
          reject(err);
        } else {
          resolve(slimer);
        }
      }, {
        phantomPath: binPath,
        parameters: {
          'load-images': 'false'
        }
      });
    });
  }

  function exit() {
    var exitCode = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

    slimer.exit();
    return exitCode;
  }

  function createPage() {
    return new Promise(function (resolve, reject) {
      slimer.createPage(function (err, page) {
        if (err) {
          reject(err);
        } else {
          // To enable logging:
          // page.onConsoleMessage = function(msg, lineNum, sourceId) {
          //    console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
          // };
          page.set('settings', {
            loadImages: false,
            userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
            webSecurityEnabled: false,
            resourceTimeout: 25000
          }, function (err) {
            if (err) {
              console.warn('Could not set page settings', err);
              reject(err);
            }
            resolve(page);
          });
        }
      });
    });
  }

  function waitForReadyState(page) {
    return new Promise(function (resolve, reject) {
      var elapsed = 0;
      var intervalLength = 1000;
      var maxWaitTime = 15000;
      var intervalId = setInterval(function () {
        page.evaluate(function () {
          return document.readyState;
        }, function (err, readyState) {
          if (err) {
            console.error('err on waitForReadyState:', err);
            page.close();
            reject(err);
          }
          console.log('ready state update err', err, 'readystate', readyState);
          elapsed += intervalLength;
          if (elapsed > maxWaitTime || readyState === 'complete') {
            clearInterval(intervalId);
            resolve(page);
          }
        });
      }, intervalLength);
    });
  }

  function navigate(url) {
    return new Promise(function (resolve, reject) {
      createPage().then(function (page) {
        page.open(url, function (err, status) {
          if (err) {
            page.close();
            reject(err);
          } else if (status === 'timeout') {
            page.close();
            reject('Timeout');
          } else {
            resolve(page);
          }
        });
      })['catch'](function (err) {
        console.error('create page err:', err);
        reject(err);
      });
    });
  }

  function extractIframes(page) {
    return new Promise(function (resolve, reject) {
      page.evaluate(function () {
        function isSupportedAdSize(width, height) {
          return width === 728 && height === 90 || width === 300 && height === 250 || width === 160 && height === 600 || width === 320 && height === 50;
        }

        function getElementContentWidth(element) {
          var styles = window.getComputedStyle(element);
          var padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
          return element.clientWidth - padding;
        }
        function getElementContentHeight(element) {
          var styles = window.getComputedStyle(element);
          var padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
          return element.clientHeight - padding;
        }

        // Gets the top most parent ID with the same dimensions as the
        // passed in node
        function getReplaceId(_x2, _x3, _x4) {
          var _again = true;

          _function: while (_again) {
            var node = _x2,
                width = _x3,
                height = _x4;
            parentWidth = parentHeight = gptPlaceholder = undefined;
            _again = false;

            if (!node.parentNode) {
              return node;
            }

            if (!node.parentNode.id) {
              return node;
            }

            var parentWidth = getElementContentWidth(node.parentNode);
            var parentHeight = getElementContentHeight(node.parentNode);

            // TODO: Check against abp-filter html rules instead
            var gptPlaceholder = node.parentNode.id.indexOf('gpt-ad-') !== -1;
            if (!gptPlaceholder && (parentWidth > width || parentHeight > height) && (
            // Single child parent which is close to the same size should be considered as replacement target
            node.parentNode.children.length !== 1 || parentHeight - height > 100 || parentWidth - width > 100)) {
              return node;
            }

            _x2 = node.parentNode;
            _x3 = width;
            _x4 = height;
            _again = true;
            continue _function;
          }
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
      }, function (err, iframesData) {
        page.close();
        if (err) {
          reject(err);
        } else {
          resolve(iframesData);
        }
      });
    });
  }

  function getAdInfo(url) {
    return new Promise(function (resolve, reject) {
      navigate(url).then(waitForReadyState).then(extractIframes).then(resolve)['catch'](reject);
    });
  }
});
//# sourceMappingURL=main.js.map