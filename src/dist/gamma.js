import { gammaLowerIncomplete, gammaLowerIncompleteInv, logGamma } from '../special'
import gamma from './_gamma'
import Distribution from './_distribution'

/**
 * Probability density function for the [gamma distribution]{@link https://en.wikipedia.org/wiki/Gamma_distribution} using the
 * shape/rate parametrization:
 *
 * $f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{\alpha - 1} e^{-\beta x},$
 *
 * where $\alpha, \beta > 0$. Support: $x > 0$.
 *
 * @class Gamma
 * @memberof ran.dist
 * @constructor
 */
export default class Gamma extends Distribution {
  /**
   * @param {number} alpha Shape parameter.
   * @param {number} beta Rate parameter.
   */
  constructor (alpha, beta) {
    super('continuous', 2)

    // Validate parameters
    /** @type {*} */
    this.p = { alpha, beta }
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling
    return gamma(this.r, this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    return Math.exp(this.p.alpha * Math.log(this.p.beta) - this.p.beta * x - logGamma(this.p.alpha)) * Math.pow(x, this.p.alpha - 1)
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.alpha, this.p.beta * x)
  }

  _q (p) {
    return gammaLowerIncompleteInv(this.p.alpha, p) / this.p.beta
  }

  /**
   * @returns {number} Shape divided by rate.
   */
  mean () {
    return this.p.alpha / this.p.beta
  }

  /**
   * @returns {number} Shape divided by squared rate.
   */
  variance () {
    return this.p.alpha / this.p.beta ** 2
  }

  /**
   * @returns {number} Two divided by the square root of the shape.
   */
  skewness () {
    return 2 / Math.sqrt(this.p.alpha)
  }

  /**
   * @returns {number} Six divided by the shape.
   */
  kurtosis () {
    return 6 / this.p.alpha
  }

  static _fitInit (data) {
    // MOM: E[X]=α/β, Var[X]=α/β² → α = mean²/var, β = mean/var
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    return [mean ** 2 / variance, mean / variance]
  }
}
