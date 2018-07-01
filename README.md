[![Build Status](https://travis-ci.org/synesenom/ran.svg?branch=master)](https://travis-ci.org/synesenom/ran)
[![npm version](https://badge.fury.io/js/ranjs.svg)](https://www.npmjs.com/package/ranjs) [![Inline docs](http://inch-ci.org/github/synesenom/ran.svg?branch=master)](http://inch-ci.org/github/synesenom/ran)

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