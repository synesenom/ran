import Normal from './normal'
import { erfinv } from '../special'

/**
 * Probability density function for the [log-normal distribution]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}:
 *
 * $f(x; \mu, \sigma) = \frac{1}{x \sigma \sqrt{2 \pi}}e^{-\frac{(\ln x - \mu)^2}{2\sigma^2}},$
 *
 * where $\mu \in \mathbb{R}$ and $\sigma > 0$. Support: $x > 0$.
 *
 * @class LogNormal
 * @memberof ran.dist
 * @constructor
 */
export default class LogNormal extends Normal {
  // Transforming normal distribution
  /**
   * @param {number} mu Location parameter.
   * @param {number} sigma Scale parameter.
   */
  constructor (mu, sigma) {
    super(mu, sigma)

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return Math.exp(super._generator())
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }

  // Inlined Normal._q to avoid V8 megamorphic deoptimization — see solutions/performance/2026-05-23-1810-super-q-v8-megamorphic-deoptimization.md
  _q (p) {
    return Math.exp(this.p.mu + this.c.sigmaRoot2 * erfinv(2 * p - 1))
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // log(Y) ~ Normal(mu, sigma): MOM on log scale gives the natural parameterization
    const n = data.length
    const logData = data.map(x => Math.log(x))
    const mu = logData.reduce((s, x) => s + x, 0) / n
    const sigma = Math.sqrt(logData.reduce((s, x) => s + (x - mu) ** 2, 0) / n) || 1
    return [mu, sigma]
  }
}
