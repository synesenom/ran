import { generalizedHarmonic, riemannZeta } from '../special'
import zeta from './_zeta'
import Distribution from './_distribution'

/**
 * Probability mass function for the [zeta distribution]{@link https://en.wikipedia.org/wiki/Zeta_distribution}:
 *
 * $f(k; s) = \frac{k^{-s}}{\zeta(s)},$
 *
 * with $s \in (1, \infty)$ and $\zeta(x)$ is the Riemann zeta function. Support: $k \in \mathbb{N}^+$.
 *
 * @class Zeta
 * @memberof ran.dist
 * @see L. Devroye, "Non-Uniform Random Variate Generation", Springer-Verlag, 1986, ch. 10.
 * @constructor
 */
export default class Zeta extends Distribution {
  /**
   * @param {number} s Exponent of the distribution.
   */
  constructor (s) {
    super('discrete', 1)

    // Validate parameters
    this.p = { s }
    Distribution.validate({ s }, [
      's > 1'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      zetaS: riemannZeta(s),
      pow2sm1: Math.pow(2, s - 1)
    }
  }

  static _fitInit (data) {
    // Hill estimator gives MLE for the power-law exponent on integer support starting at 1.
    const sumLog = data.reduce((s, x) => s + Math.log(x), 0)
    return [sumLog <= 0 ? 2 : Math.max(1.01, Math.min(100, 1 + data.length / sumLog))]
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { s } = this.p
    return s > 2 ? riemannZeta(s - 1) / this.c.zetaS : Infinity
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { s } = this.p
    if (s <= 3) return Infinity
    const mu1 = riemannZeta(s - 1) / this.c.zetaS
    return riemannZeta(s - 2) / this.c.zetaS - mu1 * mu1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { s } = this.p
    if (s <= 3) return NaN
    if (s <= 4) return Infinity
    const zs = this.c.zetaS
    const mu1 = riemannZeta(s - 1) / zs
    const mu2 = riemannZeta(s - 2) / zs
    const mu3 = riemannZeta(s - 3) / zs
    const v = mu2 - mu1 * mu1
    const cm3 = mu3 - 3 * mu1 * mu2 + 2 * mu1 * mu1 * mu1
    return cm3 / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { s } = this.p
    if (s <= 4) return NaN
    if (s <= 5) return Infinity
    const zs = this.c.zetaS
    const mu1 = riemannZeta(s - 1) / zs
    const mu2 = riemannZeta(s - 2) / zs
    const mu3 = riemannZeta(s - 3) / zs
    const mu4 = riemannZeta(s - 4) / zs
    const v = mu2 - mu1 * mu1
    const cm4 = mu4 - 4 * mu1 * mu3 + 6 * mu1 * mu1 * mu2 - 3 * mu1 * mu1 * mu1 * mu1
    return cm4 / (v * v) - 3
  }

  _generator () {
    // Rejection sampling
    return zeta(this.r, this.p.s)
  }

  _pdf (x) {
    return Math.pow(x, -this.p.s) / this.c.zetaS
  }

  _cdf (x) {
    return generalizedHarmonic(x, this.p.s) / this.c.zetaS
  }
}
