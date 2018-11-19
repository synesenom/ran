[![npm](https://img.shields.io/npm/v/ranjs.svg)](https://www.npmjs.com/package/ranjs)
[![Bundlephobia](https://img.shields.io/bundlephobia/min/ranjs.svg)](https://bundlephobia.com/result?p=ranjs@latest)
[![Bundlephobia](https://img.shields.io/bundlephobia/minzip/ranjs.svg)](https://bundlephobia.com/result?p=ranjs@latest)
[![Build Status](https://img.shields.io/travis/synesenom/ran/master.svg)](https://travis-ci.org/synesenom/ran)
[![David](https://img.shields.io/david/synesenom/ranjs.svg)](https://david-dm.org/synesenom/ran)
[![David](https://img.shields.io/david/dev/synesenom/ranjs.svg)](https://david-dm.org/synesenom/ran)
[![Inline docs](http://inch-ci.org/github/synesenom/ran.svg?branch=master)](http://inch-ci.org/github/synesenom/ran)
[![Coveralls](https://img.shields.io/coveralls/github/synesenom/ran.svg)](https://coveralls.io/github/synesenom/ran)
[![License](https://img.shields.io/npm/l/ranjs.svg)](https://www.npmjs.com/package/ranjs)

# ranjs
Library for generating various random variables in a robust and fast way. Beyond random variate generation, `ranjs` provides the following:  
- Useful statistical functions such as survival or hazard functions.  
- Test method for each generator that can be used to check if some values are sampled from a specific distribution.  
- Monte Carlo methods for estimating unknown probability distributions (only Metropolis at the moment).  


# Install
## Browser
Just include the [minified version](https://raw.githubusercontent.com/synesenom/ran/master/ran.min.js) and add

```
<script type="text/javascript" src="ran.min.js"></script>
```


## Node
```
npm install ranjs
```


# Usage
```
var ran = require('ranjs')

// Create generator
var gamma = new ran.dist.Gamma(1.3, 4.2)

// Get 100 random variates
var values = gamma.sample(100)

// Get PDF/CDF functions
var pdf = gamma.pdf
var cdf = gamma.cdf

// Higher level functions
var h = gamma.hazard
var H = gamma.cumulativeHazard

// Test if values are from this distribution
console.log(gamma.test(values))
```

## Demo
A demo observable notebook is available [here](https://beta.observablehq.com/@synesenom/ranjs-demo) to play around with the library.


# API
[https://synesenom.github.io/ran/](https://synesenom.github.io/ran/)