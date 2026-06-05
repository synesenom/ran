import { gammaLowerIncompleteInv } from '../special'
import Gamma from './gamma'
import Distribution from './_distribution'

/**
 * Probability density function for the [generalized gamma distribution]{@link https://en.wikipedia.org/wiki/Generalized_gamma_distribution}:
 *
 * $f(x; a, d, p) = \frac{p/a^d}{\Gamma(d/p)} x^{d - 1} e^{-(x/a)^p},$
 *
 * where $a, d, p > 0$. Support: $x > 0$.
 *
 * @class GeneralizedGamma
 * @memberof ran.dist
 * @constructor
 */
export default class GeneralizedGamma extends Gamma {
  // Transformation of gamma distribution
  /**
   * @param {number} a Scale parameter.
   * @param {number} d Shape parameter.
   * @param {number} p Shape parameter.
   */
  constructor (a, d, p) {
    super(d / p, Math.pow(a, -p))
    // GeneralizedGamma has 3 free parameters (a, d, p); override the 2 inherited from Gamma
    this.k = 3

    // Validate parameters
    this.p = Object.assign(this.p, { a, d, p })
    Distribution.validate({ a, d, p }, [
      'a > 0',
      'd > 0',
      'p > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: d >= 1 && p >= 1 && d >= p
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _q (p) {
    // GeneralizedGamma: X = Y^(1/p_shape) where Y ~ Gamma(d/p_shape, a^-p_shape)
    return Math.pow(gammaLowerIncompleteInv(this.p.alpha, p) / this.p.beta, 1 / this.p.p)
  }

  _generator () {
    // Direct sampling by transforming gamma variate
    return Math.pow(super._generator(), 1 / this.p.p)
  }

  _pdf (x) {
    return this.p.p * Math.pow(x, this.p.p - 1) * super._pdf(Math.pow(x, this.p.p))
  }

  _cdf (x) {
    return super._cdf(Math.pow(x, this.p.p))
  }

  static _fitInit (data) {
    // p=1 collapses to Gamma(d, 1/a): E[X]=a·d, Var[X]=a²·d → d=mean²/var, a=var/mean
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    return [variance / mean, mean ** 2 / variance, 1]
  }
}
