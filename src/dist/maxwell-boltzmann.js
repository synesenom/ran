import { gammaLowerIncompleteInv } from '../special'
import Gamma from './gamma'
import Distribution from './_distribution'

/**
 * Probability density function for the [Maxwell-Boltzmann distribution]{@link https://en.wikipedia.org/wiki/Maxwell%E2%80%93Boltzmann_distribution}:
 *
 * $f(x; a) = \sqrt{\frac{2}{\pi}}\frac{x^2 e^{-x^2 / (2a^2)}}{a^3},$
 *
 * with $a > 0$. Support: $x > 0$.
 *
 * @class MaxwellBoltzmann
 * @memberof ran.dist
 * @constructor
 */
export default class MaxwellBoltzmann extends Gamma {
  /**
   * @param {number} a Scale parameter.
   */
  constructor (a) {
    // X = sqrt(Y) where Y ~ Gamma(3/2, rate=1/(2a²)); Jacobian gives Maxwell-Boltzmann PDF
    super(1.5, 0.5 / (a * a))
    // MaxwellBoltzmann has 1 free parameter (a); override the 2 inherited from Gamma
    this.k = 1

    // Validate parameters
    Distribution.validate({ a }, [
      'a > 0'
    ])
  }

  _q (p) {
    // MaxwellBoltzmann: X = sqrt(Y) where Y ~ Gamma(3/2, 1/(2a²)); invert by sqrt
    return Math.sqrt(gammaLowerIncompleteInv(this.p.alpha, p) / this.p.beta)
  }

  _generator () {
    return Math.sqrt(super._generator())
  }

  _pdf (x) {
    return 2 * x * super._pdf(x * x)
  }

  _cdf (x) {
    return super._cdf(x * x)
  }

  /**
   * @returns {number} Two times the scale times sqrt(2/pi).
   */
  mean () {
    return 2 * Math.sqrt(1 / (this.p.beta * Math.PI))
  }

  /**
   * @returns {number} Scale squared times (3*pi - 8) / pi.
   */
  variance () {
    return (0.5 / this.p.beta) * (3 * Math.PI - 8) / Math.PI
  }

  /**
   * @returns {number} Constant 2*sqrt(2)*(16-5*pi)/(3*pi-8)^(3/2).
   */
  skewness () {
    const v = 3 * Math.PI - 8
    return 2 * Math.SQRT2 * (16 - 5 * Math.PI) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Constant 4*(-96+40*pi-3*pi^2)/(3*pi-8)^2.
   */
  kurtosis () {
    const v = 3 * Math.PI - 8
    return 4 * (-96 + 40 * Math.PI - 3 * Math.PI ** 2) / (v * v)
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // MLE: a = sqrt(mean(x²) / 3) from second-moment E[X²] = 3a²
    const n = data.length
    return [Math.sqrt(data.reduce((s, x) => s + x * x, 0) / (3 * n))]
  }
}
