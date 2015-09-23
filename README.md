# ad-info

Library to analyzes a webpage to extract container ad iframes

## Installation

    npm install --save ad-info

## Usage

    import {init, getAdInfo, exit} from 'ad-info';
    init()
      .then(getAdInfo.bind(null, 'http://www.slashdot.org'))
      .then(info => console.log('Slashdot ad containers: ', info))
      .then(getAdInfo.bind(null, 'http://news.yahoo.com'))
      .then(info => console.log('Yahoo ad containers: ', info))
      .then(exit)
      .catch((err) => console.error('something went wrong!', err))
