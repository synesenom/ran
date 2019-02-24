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

## probability distributions

`ranjs` includes more than [90 continuous and discrete distributions](https://synesenom.github.io/ran/#dist.Distribution), each tested rigorously with a floating point precision of 15 digits. Earch distribution comes with the following methods:

- sample generator
- probability density/mass function
- cumulative distribution function
- survival function
- hazard and cumulative hazard function
- likelihood and AIC/BIC methods
- test method that uses Kolmogorov-Smirnov test for continuous or $\chi^2$ tests for discrete distributions

## mcmc methods

 `ranjs` also implements a random walk Metropolis (RWM) sampler.

## install

### browser

Just include the [minified version](https://raw.githubusercontent.com/synesenom/ran/master/ran.min.js) and add

```
<script type="text/javascript" src="ran.min.js"></script>
```

### node

```
npm install ranjs
```

## usage

### distributions

```
const ran = require('ranjs')

// Create a new generator for Skellam distribution with mu1 = 1 and mu2 = 3
const skellam = new ran.dist.Skellam(1, 3)

// Generate 10K variates
let values = skellam.sample(1e4)

// Test if samples indeed follow the specified distribution
console.log(skellam.test(values))
// => { statistics: 14.025360669436635, passed: true }

// Evaluate PMF/CDF ...
for (let k = -10; k <= 10; k++) {
    console.log(k, skellam.pdf(k), skellam.cdf(k))
}
// => -4 0.10963424740027695 0.21542206959904264
//    -3 0.1662284357019246 0.38165050508716936
//    -2 0.20277318483535026 0.5844236896611729
//    ...

// ... or higher level statistical functions
for (let k = -4; k <= 4; k++) {
    console.log(k, skellam.hazard(k), skellam.cHazard(k))
}
// => -4 0.13973659359019766 0.24260937407418487
//    -3 0.26882602325948046 0.4807014556249526
//    -2 0.487932492278074 0.8780890224913454
//    ...


// Create another distribution and check their AIC
const skellam2 = new ran.dist.Skellam(1.2, 7.5)
console.log(`Skellam(1, 3):     ${skellam.aic(values)}`)
// => Skellam(1, 3):     41937.67252974663

console.log(`Skellam(1.2, 7.5): ${skellam2.aic(values)}`)
// => Skellam(1.2, 7.5): 66508.74299363888
```

## demo

A demo observable notebook is available [here](https://beta.observablehq.com/@synesenom/ranjs-demo) to play around with the library.

## API and documentation

For the full API and documentation, see: [https://synesenom.github.io/ran/](https://synesenom.github.io/ran/)

