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

    // Speed-up constants: m1..m4 (E[X^k] via the Laplace MGF) are shared verbatim by
    // mean/variance/skewness/kurtosis. Merged: Laplace's constructor already set this.c.*,
    // which super._pdf/_cdf still rely on.
    Object.assign(this.c, {
      m1: this._expMoment(1, mu, b),
      m2: this._expMoment(2, mu, b),
      m3: this._expMoment(3, mu, b),
      m4: this._expMoment(4, mu, b)
    })
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

  // Moments of X = e^Y with Y ~ Laplace(μ, b) come from the Laplace MGF
  // E[e^{kY}] = e^{μk}/(1 − b²k²), which diverges once kb ≥ 1.
  _expMoment (k, mu, b) {
    return k * b < 1 ? Math.exp(mu * k) / (1 - b * b * k * k) : Infinity
  }

  /**
   * @returns {number} The mean, $e^\mu/(1 - b^2)$; `Infinity` for $b \ge 1$.
   */
  mean () {
    return this.c.m1
  }

  /**
   * @returns {number} The variance; `Infinity` for $b \ge 1/2$.
   */
  variance () {
    if (!Number.isFinite(this.c.m2)) return Infinity
    const { m1, m2 } = this.c
    return m2 - m1 * m1
  }

  /**
   * @returns {number} The skewness; `Infinity` for $b \ge 1/3$.
   */
  skewness () {
    if (!Number.isFinite(this.c.m3)) return Infinity
    const { m1, m2, m3 } = this.c
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis; `Infinity` for $b \ge 1/4$.
   */
  kurtosis () {
    if (!Number.isFinite(this.c.m4)) return Infinity
    const { m1, m2, m3, m4 } = this.c
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 ** 4) / (v * v) - 3
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
