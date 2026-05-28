import Laplace from './laplace'

/**
 * Probability density function for the [log-Laplace distribution]{@link https://en.wikipedia.org/wiki/Log-Laplace_distribution}:
 *
 * $f(x; \mu, b) = \frac{1}{2bx}e^{-\frac{|\mathrm{ln} x - \mu|}{b}},$
 *
 * where $\mu \in \mathbb{R}$ and $b > 0$. Support: $x > 0$.
 *
 * @class LogLaplace
 * @memberof ran.dist
 * @constructor
 */
export default class LogLaplace extends Laplace {
  // Transforming Laplace distribution
  /**
   * @param {number} mu Location parameter.
   * @param {number} b Scale parameter.
   */
  constructor (mu, b) {
    super(mu, b)

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
    // Direct sampling by transforming Laplace variate
    return Math.exp(super._generator())
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }

  _q (p) {
    return p < 0.5
      ? Math.exp(this.p.mu + this.p.b * Math.log(2 * p))
      : Math.exp(this.p.mu - this.p.b * Math.log(2 - 2 * p))
  }

  static _fitInit (data) {
    // log(Y) ~ Laplace(mu, b): median is MOM for location; median absolute deviation / ln(2) for scale
    // because median(|X-mu|) = b*ln(2) for Laplace, so b = MAD / ln(2)
    const logData = data.map(x => Math.log(x)).sort((a, b) => a - b)
    const n = logData.length
    const mu = n % 2 ? logData[(n - 1) / 2] : (logData[n / 2 - 1] + logData[n / 2]) / 2
    const devs = logData.map(x => Math.abs(x - mu)).sort((a, b) => a - b)
    const mad = n % 2 ? devs[(n - 1) / 2] : (devs[n / 2 - 1] + devs[n / 2]) / 2
    return [mu, Math.max(mad / Math.LN2, 1e-3)]
  }
}
