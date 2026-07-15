# ranjs
*rán · 然 — "so; correct"*

[![Build](https://img.shields.io/github/actions/workflow/status/synesenom/ran/ci.yml?branch=main&job=build&label=build)](https://github.com/synesenom/ran/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/synesenom/ran/badge.svg?branch=main)](https://coveralls.io/github/synesenom/ran?branch=main)
[![npm](https://img.shields.io/npm/v/ranjs.svg)](https://www.npmjs.com/package/ranjs)
[![Docs](https://img.shields.io/github/actions/workflow/status/synesenom/ran/ci.yml?branch=main&job=docs-build&label=docs)](https://github.com/synesenom/ran/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/ranjs.svg)](https://www.npmjs.com/package/ranjs)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![CodeScene Average Code Health](https://codescene.io/projects/82366/status-badges/average-code-health)](https://codescene.io/projects/82366)

A comprehensive JavaScript library for probability distributions, random variate generation, and statistical analysis.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [npm](#npm)
  - [CDN (browser)](#cdn-browser)
- [Usage](#usage)
  - [ESM — single distribution import](#esm--single-distribution-import)
  - [CommonJS / full bundle](#commonjs--full-bundle)
  - [Reproducible sampling](#reproducible-sampling)
  - [Model comparison](#model-comparison)
  - [Parameter estimation](#parameter-estimation)
- [API Overview](#api-overview)
- [Distribution API](#distribution-api)
  - [State serialisation](#state-serialisation)
- [Process API](#process-api)
- [MC API](#mc-api)
- [Return values and errors](#return-values-and-errors)
- [Numerical precision](#numerical-precision)
  - [Test reference values](#test-reference-values)
- [Documentation](#documentation)
- [License](#license)

## Features

- **144 probability distributions** — continuous and discrete, each with PDF/PMF, CDF, quantile (`q`), hazard, survival, log-likelihood (`lnL`), AIC/BIC, goodness-of-fit testing, and MLE fitting (`fit`)
- **Statistical measures** — location (mean, median, mode, …), dispersion (variance, IQR, Gini, …), shape (skewness, kurtosis, …), and dependence (Pearson, Spearman, Kendall, …)
- **Hypothesis tests** — Bartlett, Levene, Brown–Forsythe, Mann–Whitney U, HSIC
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
// => { statistics: 14.025360669436635, passed: true }

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

### Parameter estimation

ranjs closes the full statistical cycle — define a model, generate data, fit parameters from data via MLE, then verify the fit:

```javascript
import { dist } from 'ranjs'

// 1. Define and sample
const model = new dist.Normal(3, 1).seed(42)
const data  = model.sample(500)

// 2. Fit parameters from data via MLE
const fitted = dist.Normal.fit(data)
console.log(fitted.p)           // => { mu: 3.000, sigma: 1.000 }

// 3. Test goodness of fit
console.log(fitted.test(data))  // => { statistics: 0.42, passed: true }
```

`fit()` is a **static** method called on the class, not on an instance: `dist.Normal.fit(data)`, not `model.fit(data)`. All 144 exported distributions support `fit()`. Most have a data-aware initial guess for reliable MLE convergence; zero-parameter distributions skip optimization and return a fresh instance.

## API Overview

| Namespace | Contents |
|-----------|----------|
| `ran.dist` | 144 probability distributions |
| `ran.process` | Stochastic processes: AR(1), Brownian motion, Brownian bridge, Cox–Ingersoll–Ross, geometric Brownian motion, Ornstein–Uhlenbeck, Poisson process, random walk |
| `ran.mc` | Random-walk Metropolis sampler, Gelman–Rubin convergence diagnostic |
| `ran.location` | Mean, median, mode, geometric mean, harmonic mean, trimean, midrange |
| `ran.dispersion` | Variance, standard deviation, IQR, Gini coefficient, entropy, CV, … |
| `ran.shape` | Skewness, kurtosis, quantiles, moments, min, max, rank |
| `ran.dependence` | Pearson, Spearman, Kendall, distance correlation, Kullback–Leibler, … |
| `ran.test` | Bartlett, Levene, Brown–Forsythe, Mann–Whitney U, HSIC |
| `ran.core` | Seeded PRNG (xoshiro128+), uniform float/int/bool generators |

## Distribution API

Every distribution exposes a consistent interface:

```javascript
const d = new ran.dist.Gamma(2, 1)

d.type()          // 'continuous' or 'discrete'
d.params()        // current parameter object, e.g. { alpha: 2, beta: 1 }
d.support()       // [{ value, closed }, { value, closed }] — lower/upper bounds
d.sample(n)       // generate n random variates
d.pdf(x)          // probability density / mass function
d.cdf(x)          // cumulative distribution function
d.q(p)            // inverse CDF (quantile function)
d.survival(x)     // complementary CDF  (1 − CDF)
d.hazard(x)       // hazard rate        (pdf / survival)
d.cHazard(x)      // cumulative hazard  (−log survival)
d.lnPdf(x)        // log probability density / mass
d.lnL(data)       // log-likelihood over an array of observations
d.aic(data)       // Akaike information criterion
d.bic(data)       // Bayesian information criterion
d.test(data)      // Anderson-Darling test (continuous) or chi-squared test (discrete)
d.seed(value)     // set PRNG seed; returns the instance

ran.dist.Gamma.fit(data)    // static — MLE fit; returns a new instance
```

### State serialisation

`save()` and `load(state)` let you snapshot and restore the exact PRNG state and parameters of a distribution instance, so a sequence of samples can be reproduced exactly across sessions or process restarts.

```javascript
const d = new ran.dist.Gamma(2, 1)
d.seed(42)
d.sample(10)                         // advance the internal PRNG

const state = d.save()               // plain object: { type, params, prngState, ... }
const d2 = ran.dist.Gamma.load(state)  // new instance with identical state

d.sample(5)   // some sequence of variates
d2.sample(5)  // identical sequence — same PRNG position, same parameters
```

## Process API

Every process in `ran.process` extends a common `Process` base class and exposes the same interface:

```javascript
const bm = new ran.process.BrownianMotion(0, 1, 0.1)  // mu=0, sigma=1, dt=0.1

bm.next()             // advance one step; returns the new state
bm.reset()            // reset to initial state
bm.state()            // current state value
bm.path(100)          // generate a path of 100 steps; returns array of 101 states
bm.ensemble(5, 100)   // generate 5 independent paths of 100 steps each
bm.pdf(x, t)          // marginal density at state x and time t
bm.mean(t)            // theoretical mean at time t
bm.variance(t)        // theoretical variance at time t
bm.covariogram(s, t)  // theoretical covariance Cov(X(s), X(t))
bm.seed(42)           // seed the PRNG for reproducible paths; returns the instance
```

Available processes:

| Class | Description |
|-------|-------------|
| `ran.process.AR1(phi, sigma)` | First-order autoregressive process; stationary for \|φ\| < 1 |
| `ran.process.BrownianMotion(mu, sigma, dt)` | Brownian motion with drift; exact discrete-time sampler |
| `ran.process.OrnsteinUhlenbeck(theta, mu, sigma, dt)` | Mean-reverting process; exact discrete-time sampler |
| `ran.process.GeometricBrownianMotion(mu, sigma, dt)` | Multiplicative Brownian motion; log-normal increments |
| `ran.process.BrownianBridge(sigma, T, dt)` | Brownian bridge pinned to 0 at time T |
| `ran.process.PoissonProcess(lambda, dt)` | Counting process with Poisson(λ·dt) increments per step |

## MC API

`ran.mc` provides Markov chain Monte Carlo sampling and convergence diagnostics for targets whose density is known only up to a normalizing constant.

```javascript
const rwm = new ran.mc.RWM(logDensity, { dim: 1 })  // logDensity: unnormalized log target density

rwm.warmUp()           // tune proposal step size and the thinning interval
rwm.sample(null, 1000) // draw 1000 (thinned) samples
rwm.statistics()       // per-dimension { mean, std, cv } since the last reset
rwm.ar()               // acceptance rate over the most recent config.arWindow iterations (sliding window)
rwm.ac()               // autocorrelation vs. lag, per dimension
rwm.state()            // snapshot: { x, samplingRate, internal } for resuming a chain
rwm.seed(42)           // seed the PRNG for reproducible chains; returns the instance
```

Available samplers:

| Class | Description |
|-------|-------------|
| `ran.mc.RWM(logDensity, config, initialState)` | Random-walk Metropolis-Hastings sampler with Robbins-Monro step-size adaptation during warm-up |
| `ran.mc.AdaptiveMetropolis(logDensity, config, initialState)` | Full-covariance adaptive Metropolis (Haario-Saksman-Tamminen 2001); adapts the joint proposal covariance from the chain's own history during warm-up, then freezes it for sampling |
| `ran.mc.Gibbs(conditionals, config, initialState)` | Component-wise (systematic-scan) Gibbs sampler; draws each dimension directly from its full conditional, so every iteration is accepted (`ar()` is always 1.0) |

`ran.mc.gelmanRubin(samples, maxLength)` computes the R-hat convergence diagnostic across two or more independent chains (each an array of states returned by `sample()`):

```javascript
const chain1 = new ran.mc.RWM(logDensity, { dim: 1 }).seed(1)
chain1.warmUp()
const chain2 = new ran.mc.RWM(logDensity, { dim: 1 }).seed(2)
chain2.warmUp()

const rHat = ran.mc.gelmanRubin([chain1.sample(null, 500), chain2.sample(null, 500)])
// rHat[0] → R-hat vs. iteration count for dimension 0; values near 1 indicate convergence
```

`ran.mc.runChains(logDensity, config, options)` mechanizes the pattern above: it constructs multiple independently-seeded `RWM` chains, warms up and samples each, and returns their samples plus the `gelmanRubin()` diagnostic in one call — the recommended workflow for gating MCMC convergence (single-chain diagnostics cannot distinguish "converged" from "stuck"):

```javascript
const { samples, rhat } = ran.mc.runChains(logDensity, { dim: 1 })
// samples → one sample array per chain (2 chains, seeded [1, 2] by default)
// rhat    → the gelmanRubin() diagnostic across those chains
```

## Return values and errors

`ranjs` signals an unusual result through one of four channels, chosen by the *kind* of situation:

| Situation | What you get |
| --- | --- |
| Invalid input — missing/NaN parameters, broken constraints, wrong arity, mismatched dimensions | a **thrown `Error`** |
| A valid query whose answer is mathematically undefined (e.g. the mean of a Cauchy distribution) | **`NaN`** |
| A valid query whose answer diverges (e.g. the variance of a Pareto with shape ≤ 2, any moment of a Lévy) | **`Infinity`** (or `-Infinity`) |
| A correct value that simply equals zero (e.g. a density evaluated outside the support) | **`0`** |

Functions never return `undefined` to mean "failed" or "does not exist" — numeric results stay numbers (`NaN`/`Infinity`), and genuine misuse throws. `NaN` and `Infinity` are kept distinct on purpose: `NaN` means *no value exists*, `Infinity` means *the value grows without bound*. This mirrors the conventions of SciPy and R.

```javascript
const ran = require('ranjs')

new ran.dist.Cauchy(0, 1).mean()       // => NaN       (undefined moment)
new ran.dist.Pareto(1, 2).variance()   // => Infinity  (divergent moment)
new ran.dist.Normal(0, 1).pdf(-Infinity) // => 0       (outside support)
```

## Numerical precision

ranjs targets **≤ 1e-14 relative error** for all public outputs in non-degenerate parameter regions. Outputs involving deeply composed operations (quantile inversion, extreme parameter regimes) have a documented floor of **~1e-12**, looser still for a handful of quantiles computed by numerical root-finding or near-boundary asymptotics (see below).

### Test reference values

All reference values in `test/dist-cases-continuous.js` and `test/dist-cases-discrete.js` are sourced from external tools — [mpmath](https://mpmath.org/) at `mp.dps = 50`, scipy.stats, or Wolfram Alpha — never computed from ranjs itself. Use `scripts/gen-dist-refs.py` to generate reference values when adding a new distribution, and verify at least one value per distribution against an independent source. pdf, cdf, and pmf reference-value assertions enforce **1e-14 relative tolerance** by default; distributions that cannot reach 1e-14 in specific regimes use **1e-12** with an explanatory comment.

All 29 discrete distributions are verified against mpmath references at 50 decimal places. BetaBinomial and NegativeHypergeometric sit at the ~2e-14 float64 arithmetic floor. The following distributions cap at 1e-12 at certain parameter settings: Binomial, Hypergeometric, NegativeBinomial, Poisson, Skellam.

All 112 continuous distributions are likewise verified against mpmath references at 50 decimal places (three parameter sets each). **pdf/cdf** cap at 1e-12–1e-13 at certain parameter settings for: Bates, IrwinHall, Levy, NoncentralBeta, NoncentralChi, NoncentralT, DoublyNoncentralT, SkewNormal, Rice, and R. **Quantiles** with a closed-form or Halley-refined inverse round-trip to 1e-14; those computed by numerical root-finding (BaldingNichols, Bates, BetaPrime, Davis, FisherZ, Muth, NoncentralChi2, NoncentralF, DoublyNoncentralChi2, DoublyNoncentralT, SkewNormal, Student's t/z, UniformProduct, R) round-trip to ~1e-13–1e-10, and BenktanderII's near-boundary asymptotic branch (b → 1) to ~1e-9.

## Documentation

Full API reference and distribution catalogue: [https://synesenom.github.io/ran/](https://synesenom.github.io/ran/)

## License

[MIT](https://opensource.org/licenses/MIT)
