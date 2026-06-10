import Distribution from './_distribution'

/**
 * Probability density function for the continuous
 * [uniform distribution]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}:
 *
 * $f(x; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min}},$
 *
 * with $x_\mathrm{min}, x_\mathrm{max} \in \mathbb{R}$ and $x_\mathrm{min} < x_\mathrm{max}$.
 * Support: $x \in \[x_\mathrm{min}, x_\mathrm{max}\]$.
 *
 * Cumulative distribution function:
 *
 * $F(x; a, b) = \frac{x - a}{b - a}$
 *
 * @class Uniform
 * @memberof ran.dist
 * @constructor
 */
export default class Uniform extends Distribution {
  /**
   * @param {number} xmin Lower boundary.
   * @param {number} xmax Upper boundary.
   */
  constructor (xmin, xmax) {
    super('continuous', 2)

    // Validate parameters
    this.p = { xmin, xmax }
    Distribution.validate({ xmin, xmax }, [
      'xmin < xmax'
    ])

    // Set support
    this.s = [{
      value: xmin,
      closed: true
    }, {
      value: xmax,
      closed: true
    }]

    // Speed-up constants
    this.c = {
      range: xmax - xmin
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf () {
    return 1 / this.c.range
  }

  _cdf (x) {
    return (x - this.p.xmin) / this.c.range
  }

  _q (p) {
    return p * this.c.range + this.p.xmin
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return (this.p.xmin + this.p.xmax) / 2
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return this.c.range * this.c.range / 12
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return -1.2
  }

  static _fitInit (data) {
    // Exact MLE: the tightest support containing the data, i.e. [min, max] (the support is closed
    // at both ends, so endpoints have finite density). Pad only for degenerate constant data,
    // where xmin < xmax cannot otherwise hold and no Uniform MLE exists in the family.
    const lo = Math.min(...data)
    const hi = Math.max(...data)
    if (hi > lo) {
      return [lo, hi]
    }
    const eps = Math.abs(lo) * 0.01 || 1e-6
    return [lo - eps, hi + eps]
  }
}
