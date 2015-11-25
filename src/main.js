// Note: The process.env.PAGE_TIMEOUT environment variable may be set to override
// the default number of milliseconds this process will wait for all page
// requests to complete.

require('babel-polyfill')
var phantom = require('node-slimer')
var fs = require('fs')
var url = require('url')
var ABPFilterParser = require('abp-filter-parser')
var slimer
let parsedFilterData = {}
let cachedFilterData = {}

var slimerjs = require('slimerjs')
var binPath = slimerjs.path

const startTime = () => process.hrtime()
const endTime = start => {
  let diff = process.hrtime(start)
  return diff[0] * 1000 + diff[1] / 1000000 // divide by a million to get nano to milli
}

export function init (easyListPath) {
  return new Promise((resolve, reject) => {
    let easyListTxt = fs.readFileSync(easyListPath, 'utf-8')
    ABPFilterParser.parse(easyListTxt, parsedFilterData)
    console.log('Done parsing easylist!')
    phantom.create((err, sl) => {
      slimer = sl
      if (err) {
        console.error('init error:', err)
        reject(err)
      } else {
        resolve(slimer)
      }
    }, {
      phantomPath: binPath,
      parameters: {
        'load-images': 'false'
      }
    })
  })
}

export function exit (exitCode = 0) {
  slimer.exit()
  return exitCode
}

function createPage (urlToNavigate) {
  return new Promise((resolve, reject) => {
    slimer.createPage((err, page) => {
      if (err) {
        reject(err)
      } else {
        // To enable logging:
        // page.onConsoleMessage = function(msg, lineNum, sourceId) {
        //    console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
        // };
        page.pageLoadStartTime = startTime()
        page.resourcesRequested = []
        page.resourcesBlocked = []
        page.abpTime = 0

        page.onResourceRequested = function (requestData) {
          let urlToCheck = url.parse(requestData[0].url)
          let currentPageHostname = url.parse(urlToNavigate).hostname
          page.resourcesRequested.push(urlToCheck.href)

          let abpTime = startTime()
          if (ABPFilterParser.matches(parsedFilterData, urlToCheck.href, {
            domain: currentPageHostname,
            elementTypeMaskMap: ABPFilterParser.elementTypes.SCRIPT
          }, cachedFilterData)) {
            // console.log('block: ', urlToCheck.href);
            page.resourcesBlocked.push(urlToCheck.href)
          } else {
            // console.log('noblock: ', urlToCheck.href);
          }
          page.abpTime += endTime(abpTime)

          // console.log('Request (#' + requestData.id + '): ' + JSON.stringify(requestData));
        }
        page.set('settings', {
          loadImages: false,
          userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
          webSecurityEnabled: false,
          resourceTimeout: 60000
        }, (err2) => {
          if (err2) {
            console.warn('Could not set page settings', err2)
            reject(err2)
          }
          resolve(page)
        })
      }
    })
  })
}

function waitForReadyState (page) {
  return new Promise((resolve, reject) => {
    let elapsed = 0
    let intervalLength = 1000
    let maxWaitTime = 15000
    let intervalId = setInterval(function () {
      page.evaluate(function () {
        return document.readyState
      }, function (err, readyState) {
        if (err) {
          console.error('err on waitForReadyState:', err)
          page.close()
          reject(err)
        }
        console.log('ready state update err', err, 'readystate', readyState)
        elapsed += intervalLength
        if (elapsed > maxWaitTime || readyState === 'complete') {
          clearInterval(intervalId)
          resolve(page)
        }
      })
    }, intervalLength)
  })
}

function setExternalTimeout (page, urlToNavigate, resolve, reject) {
  // This guards against the page spinning because of long
  // running connections. Slimer does not currently handle the
  // resourceTimeout parameter so we have to do it manually on
  // an entire page level here. https://github.com/laurentj/slimerjs/issues/43
  let id = setTimeout(() => {
    page.close()
    reject('Page timeout')
  }, process.env.PAGE_TIMEOUT || 30000)

  page.open(urlToNavigate, (err, status) => {
    // The page returned so disable the timeout
    clearTimeout(id)

    if (err) {
      page.close()
      reject(err)
    } else if (status === 'timeout') {
      page.close()
      reject('Timeout')
    } else {
      resolve(page)
    }
  })
}

function navigate (urlToNavigate) {
  return new Promise((resolve, reject) => {
    createPage(urlToNavigate).then(page => {
      setExternalTimeout(page, urlToNavigate, resolve, reject)
    }).catch(err => {
      console.error('create page err:', err)
      reject(err)
    })
  })
}

function extractIframes (page) {
  return new Promise((resolve, reject) => {
    page.evaluate(function () {
      function isSupportedAdSize (width, height) {
        return width === 728 && height === 90 ||
          width === 300 && height === 250 ||
          width === 160 && height === 600 ||
          width === 320 && height === 50
      }

      function getElementContentWidth (element) {
        var styles = window.getComputedStyle(element)
        var padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
        return element.clientWidth - padding
      }
      function getElementContentHeight (element) {
        var styles = window.getComputedStyle(element)
        var padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom)
        return element.clientHeight - padding
      }

      // Gets the top most parent ID with the same dimensions as the
      // passed in node
      function getReplaceId (node, width, height) {
        if (!node.parentNode) {
          return node
        }

        if (!node.parentNode.id) {
          return node
        }

        var parentWidth = getElementContentWidth(node.parentNode)
        var parentHeight = getElementContentHeight(node.parentNode)

        // TODO: Check against abp-filter html rules instead
        var gptPlaceholder = node.parentNode.id.indexOf('gpt-ad-') !== -1
        if (!gptPlaceholder && (parentWidth > width || parentHeight > height) &&
            // Single child parent which is close to the same size should be considered as replacement target
            (node.parentNode.children.length !== 1 || parentHeight - height > 100 || parentWidth - width > 100)) {
          return node
        }

        return getReplaceId(node.parentNode, width, height)
      }

      var iframes = document.querySelectorAll('iframe')
      var iframesData = []
      for (var i = 0; i < iframes.length; i++) {
        var iframe = iframes[i]
        var width = getElementContentWidth(iframe)
        var height = getElementContentHeight(iframe)
        if (isSupportedAdSize(width, height)) {
          iframesData.push({
            // src: iframe.src,
            width: width,
            height: height,
            // top: rect.top,
            // left: rect.left,
            // name: iframe.name,
            // id: iframe.id,
            replaceId: getReplaceId(iframe, width, height).id
          })
        }
      }
      return iframesData
    }, function (err, iframesData) {
      page.close()
      if (err) {
        reject(err)
      } else {
        resolve({
          numResourcesRequested: page.resourcesRequested.length,
          resourcesRequested: page.resourcesRequested,
          numResourcesBlocked: page.resourcesBlocked.length,
          resourcesBlocked: page.resourcesBlocked,
          abpTime: page.abpTime,
          pageLoadTime: endTime(page.pageLoadStartTime),
          bloomNegativeCount: cachedFilterData.bloomNegativeCount,
          bloomPositiveCount: cachedFilterData.bloomPositiveCount,
          notMatchCount: cachedFilterData.notMatchCount,
          bloomFalsePositiveCount: cachedFilterData.bloomFalsePositiveCount,
          badFingerprints: cachedFilterData.badFingerprints,
          matchedFilters: cachedFilterData.matchedFilters,
          iframesData
        })
      }
    })
  })
}

export function getAdInfo (urlToCheck) {
  return new Promise((resolve, reject) => {
    navigate(urlToCheck)
      .then(waitForReadyState)
      .then(extractIframes)
      .then(resolve)
      .catch(reject)
  })
}
