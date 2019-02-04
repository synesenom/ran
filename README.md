[![Build Status](https://img.shields.io/travis/synesenom/ran/master.svg)](https://travis-ci.org/synesenom/ran)
[![Coverage Status](https://coveralls.io/repos/github/synesenom/ran/badge.svg?branch=master)](https://coveralls.io/github/synesenom/ran?branch=master)
[![npm](https://img.shields.io/npm/v/ranjs.svg)](https://www.npmjs.com/package/ranjs)
[![David](https://img.shields.io/david/synesenom/ranjs.svg)](https://david-dm.org/synesenom/ran)
[![David](https://img.shields.io/david/dev/synesenom/ranjs.svg)](https://david-dm.org/synesenom/ran)
[![Inline docs](http://inch-ci.org/github/synesenom/ran.svg?branch=master)](http://inch-ci.org/github/synesenom/ran)
[![License](https://img.shields.io/npm/l/ranjs.svg)](https://www.npmjs.com/package/ranjs)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

# ranjs

Statistical library for generating various random variates, calculating likelihood functions and testing hypotheses (and more).


# probability distributions
`ranjs` includes more than [60 continuous and discrete distributions](https://synesenom.github.io/ran/#dist.Distribution), each tested rigorously

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