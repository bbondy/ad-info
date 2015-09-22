require("babel/polyfill");
var phantom = require('node-slimer');
var fs = require('fs');
var ABPFilterParser = require('abp-filter-parser');
var slimer;

export function init(slimerPath) {
  return new Promise((resolve, reject) => {
    phantom.create((err, sl) => {
      slimer = sl;
      if (err) {
        console.error('init error:', err);
        reject(err);
      } else {
        resolve(slimer);
      }
    }, {
      phantomPath: slimerPath,
      parameters: {
        'load-images': 'no',
      }
    });
  });
}

export function exit(exitCode = 0) {
  slimer.exit();
  return exitCode;
}

function createPage(url) {
  return new Promise((resolve, reject) => {
    slimer.createPage((err, page) => {
      if (err) {
        reject(err);
      } else {
        resolve(page);
      }
    });
  });
}

function waitForReadyState(page) {
  return new Promise((resolve, reject) => {
    let elapsed = 0;
    let intervalLength = 1000;
    let maxWaitTime = 15000;
    let intervalId = setInterval(function() {
      let readyState = page.evaluate(function () {
        return document.readyState;
      }, function(err, readyState) {
        if (err) {
          console.log('err on waitForReadyState:', err);
          reject(err);
        }
        console.log('ready state update err', err, 'readystate', readyState);
        elapsed += intervalLength;
        if (elapsed > maxWaitTime || "complete" === readyState) {
          clearInterval(intervalId);
          resolve(page);
        }
      });
    }, intervalLength);
  });
}

export function navigate(url) {
  return new Promise((resolve, reject) => {
    createPage(url).then(page => {
      page.open(url, function (err, status) {
        if (err) {
          reject(err);
        } else {
          resolve(page);
        }
      });
    }).catch(err => {
      console.log('create page err!');
      reject(err);
    });
  });
}

function getAdInfo(page) {
  return new Promise((resolve, reject) => {
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
        gptPlaceholder = gptPlaceholder || !!node.parentNode.children.length;

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
    }, function(err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}


init('./slimerjs-0.9.6/slimerjs')
  .then(navigate.bind(null, 'http://www.slashdot.org'))
  .then(waitForReadyState)
  .then(getAdInfo)
  .then((info) => {
    console.log(info);
  })
  .then(exit.bind(null, 0));
