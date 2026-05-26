<p align="center">
  <img src="docs/assets/ran.svg" alt="ranjs logo" width="120" />
</p>

# ranjs

[![Build](https://img.shields.io/github/actions/workflow/status/synesenom/ran/ci.yml?branch=main&job=build&label=build)](https://github.com/synesenom/ran/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/synesenom/ran/badge.svg?branch=main)](https://coveralls.io/github/synesenom/ran?branch=main)
[![npm](https://img.shields.io/npm/v/ranjs.svg)](https://www.npmjs.com/package/ranjs)
[![Docs](https://img.shields.io/github/actions/workflow/status/synesenom/ran/ci.yml?branch=main&job=docs-build&label=docs)](https://github.com/synesenom/ran/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/ranjs.svg)](https://www.npmjs.com/package/ranjs)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

A comprehensive JavaScript library for probability distributions, random variate generation, and statistical analysis.

## Features

- **130+ probability distributions** — continuous and discrete, each with PDF/PMF, CDF, quantile, hazard, survival, likelihood, AIC/BIC, and built-in goodness-of-fit testing
- **Statistical measures** — location (mean, median, mode, …), dispersion (variance, IQR, Gini, …), shape (skewness, kurtosis, …), and dependence (Pearson, Spearman, Kendall, …)
- **Hypothesis tests** — Bartlett, Levene, Brown–Forsythe, Mann–Whitney U, HSIC
- **MCMC samplers** — random-walk Metropolis and slice sampling with Gelman–Rubin convergence diagnostics
- **Reproducible sampling** — every distribution accepts an optional seed for deterministic output
- **TypeScript support** — declaration files generated from JSDoc, covering all public APIs
- **Tree-shakeable** — import individual distributions without pulling in the full bundle

## Installation

### npm

```bash
npm install ranjs
```

### CDN (browser)

```html
<script src="https://unpkg.com/ranjs/dist/ranjs.min.js"></script>
```

The library is exported globally as `ranjs`.

## Usage

### ESM — single distribution import

Import a single distribution for minimal bundle size:

```javascript
import Normal from 'ranjs/dist/normal'

const n = new Normal(0, 1)

n.pdf(0)       // => 0.3989422804014327
n.cdf(1.96)    // => 0.9750021048517796
n.sample(5)    // => [0.42, -1.03, 0.17, 1.81, -0.55]
```

### CommonJS / full bundle

```javascript
const ran = require('ranjs')

const skellam = new ran.dist.Skellam(1, 3)
const values  = skellam.sample(1e4)

skellam.test(values)
// => { statistic: 14.025360669436635, passed: true }

for (let k = -4; k <= 4; k++) {
  console.log(k, skellam.pdf(k), skellam.cdf(k))
}
// => -4  0.10963424740027695  0.21542206959904264
//    -3  0.16622843570192460  0.38165050508716936
//    -2  0.20277318483535026  0.58442368966117290
//    ...
```

### Reproducible sampling

Every distribution can be individually seeded:

```javascript
import Gamma from 'ranjs/dist/gamma'

const g = new Gamma(2, 1)
g.seed(42)
g.sample(3)  // always produces the same sequence
```

### Model comparison

```javascript
const ran = require('ranjs')

const data     = new ran.dist.Skellam(1, 3).sample(1e4)
const fitted   = new ran.dist.Skellam(1, 3)
const misfit   = new ran.dist.Skellam(1.2, 7.5)

console.log(fitted.aic(data))   // => 41937.67252974663
console.log(misfit.aic(data))   // => 66508.74299363888
```

## API Overview

| Namespace | Contents |
|-----------|----------|
| `ran.dist` | 130+ probability distributions |
| `ran.location` | Mean, median, mode, geometric mean, harmonic mean, trimean, midrange |
| `ran.dispersion` | Variance, standard deviation, IQR, Gini coefficient, entropy, CV, … |
| `ran.shape` | Skewness, kurtosis, quantiles, moments, min, max, rank |
| `ran.dependence` | Pearson, Spearman, Kendall, distance correlation, Kullback–Leibler, … |
| `ran.test` | Bartlett, Levene, Brown–Forsythe, Mann–Whitney U, HSIC |
| `ran.mc` | Random-walk Metropolis, slice sampling, Gelman–Rubin diagnostic |
| `ran.core` | Seeded PRNG (xoshiro128+), uniform float/int/bool generators |

## Distribution API

Every distribution exposes a consistent interface:

```javascript
const d = new ran.dist.Gamma(2, 1)

d.sample(n)       // generate n random variates
d.pdf(x)          // probability density / mass function
d.cdf(x)          // cumulative distribution function
d.quantile(p)     // inverse CDF
d.survival(x)     // complementary CDF  (1 − CDF)
d.hazard(x)       // hazard rate        (pdf / survival)
d.cHazard(x)      // cumulative hazard  (−log survival)
d.likelihood(xs)  // log-likelihood over an array of observations
d.aic(xs)         // Akaike information criterion
d.bic(xs)         // Bayesian information criterion
d.test(xs)        // KS test (continuous) or chi-squared test (discrete)
```

## Documentation

Full API reference and distribution catalogue: [https://synesenom.github.io/ran/](https://synesenom.github.io/ran/)

## License

[MIT](https://opensource.org/licenses/MIT)
