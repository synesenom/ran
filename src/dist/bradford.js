import Distribution from './_distribution'

/**
 * Probability density function for the [Bradford distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bradford.html}:
 *
 * $f(x; c) = \frac{c}{\ln(1 + c) (1 + c x)},$
 *
 * with $c > 0$. Support: $x \in \[0, 1\]$.
 *
 * Cumulative distribution function:
 *
 * $F(x; c) = \frac{\ln(1 + cx)}{\ln(1 + c)}$
 *
 * @class Bradford
 * @memberof ran.dist
 * @constructor
 */
export default class Bradford extends Distribution {
  /**
   * @param {number} c Shape parameter.
   */
  constructor (c) {
    super('continuous', 1)

    // Validate parameters
    this.p = { c }
    Distribution.validate({ c }, [
      'c > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]

    // Speed-up constants
    const log1pc = Math.log(1 + c)
    this.c = {
      log1pc,
      cOverLog1pc: c / log1pc
    }
  }

  static _fitInit (data) {
    // Bradford E[X] ≈ ½ − c/12 for small c; invert as starting value, default c=1 when outside (0,½)
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [mean > 0 && mean < 0.5 ? Math.max(1e-3, 6 * (1 - 2 * mean)) : 1]
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const L = this.c.log1pc
    const c = this.p.c
    return (c - L) / (c * L)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const L = this.c.log1pc
    const c = this.p.c
    const mu = this.mean()
    return 1 / (2 * L) - 1 / (c * L) + 1 / (c * c) - mu * mu
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const L = this.c.log1pc
    const c = this.p.c
    const mu = this.mean()
    const sigma2 = this.variance()
    const e2 = 1 / (2 * L) - 1 / (c * L) + 1 / (c * c)
    const e3 = 1 / (3 * L) - 1 / (2 * c * L) + 1 / (c * c * L) - 1 / (c * c * c)
    const mu3 = e3 - 3 * mu * e2 + 2 * mu * mu * mu
    return mu3 / Math.pow(sigma2, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const L = this.c.log1pc
    const c = this.p.c
    const mu = this.mean()
    const sigma2 = this.variance()
    const e2 = 1 / (2 * L) - 1 / (c * L) + 1 / (c * c)
    const e3 = 1 / (3 * L) - 1 / (2 * c * L) + 1 / (c * c * L) - 1 / (c * c * c)
    const e4 = 1 / (4 * L) - 1 / (3 * c * L) + 1 / (2 * c * c * L) - 1 / (c * c * c * L) + 1 / Math.pow(c, 4)
    const mu4 = e4 - 4 * mu * e3 + 6 * mu * mu * e2 - 3 * Math.pow(mu, 4)
    return mu4 / (sigma2 * sigma2) - 3
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c.cOverLog1pc / (1 + this.p.c * x)
  }

  _cdf (x) {
    return Math.log(1 + this.p.c * x) / this.c.log1pc
  }

  _q (p) {
    return (Math.exp(this.c.log1pc * p) - 1) / this.p.c
  }
}
