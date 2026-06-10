import Distribution from './_distribution'

/**
 * Probability density function for the [hyperbolic secant distribution]{@link https://en.wikipedia.org/wiki/Hyperbolic_secant_distribution}:
 *
 * $$f(x) = \frac{1}{2}\mathrm{sech}\Big(\frac{\pi}{2} x\Big).$$
 *
 * Support: $x \in \mathbb{R}$.
 *
 * Cumulative distribution function:
 *
 * $F(x) = \frac{2}{\pi}\arctan\left(e^{\pi x/2}\right)$
 *
 * @class HyperbolicSecant
 * @memberof ran.dist
 * @constructor
 */
export default class HyperbolicSecant extends Distribution {
  /** */
  constructor () {
    super('continuous', 0)
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return 0
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return 1
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
    return 2
  }

  _pdf (x) {
    return 0.5 / Math.cosh(0.5 * Math.PI * x)
  }

  _cdf (x) {
    return 2 * Math.atan(Math.exp(0.5 * Math.PI * x)) / Math.PI
  }

  _q (p) {
    return 2 * Math.log(Math.tan(0.5 * Math.PI * p)) / Math.PI
  }
}
