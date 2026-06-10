import Distribution from './_distribution'

/**
 * Probability density function for the [generalized extreme value distribution]{@link https://en.wikipedia.org/wiki/Generalized_extreme_value_distribution}:
 *
 * $f(x; c) = (1 - cx)^{1 / c - 1} e^{-(1 - cx)^{1 / c}},$
 *
 * with $c \ne 0$. Support: $x \in (-\infty, 1 / c]$ if $c > 0$, $x \in [1 / c, \infty)$ otherwise.
 *
 * Cumulative distribution function:
 *
 * $F(x; c) = \exp\left(-(1 - cx)^{1/c}\right)$
 *
 * @class GeneralizedExtremeValue
 * @memberof ran.dist
 * @constructor
 */
export default class GeneralizedExtremeValue extends Distribution {
  /**
   * @param {number} c Shape parameter.
   */
  constructor (c) {
    super('continuous', 1)

    // Validate parameters
    this.p = { c }
    Distribution.validate({ c }, [
      'c != 0'
    ])

    // Set support
    this.s = [{
      value: c > 0 ? -Infinity : 1 / c,
      closed: c < 0
    }, {
      value: c > 0 ? 1 / c : Infinity,
      closed: c > 0
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.exp(-Math.pow(1 - this.p.c * x, 1 / this.p.c)) * Math.pow(1 - this.p.c * x, 1 / this.p.c - 1)
  }

  _cdf (x) {
    return Math.exp(-Math.pow(1 - this.p.c * x, 1 / this.p.c))
  }

  _q (p) {
    return (1 - Math.pow(-Math.log(p), this.p.c)) / this.p.c
  }

  static _fitInit (data) {
    // GEV skewness exceeds the Gumbel limit (≈1.14) when c < 0 (heavier right tail)
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const m2 = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const skewness = data.reduce((s, x) => s + Math.pow((x - mean) / Math.sqrt(m2), 3), 0) / n
    return [skewness > 1.14 ? -0.1 : 0.1]
  }
}
