import { gammaLowerIncomplete, gammaLowerIncompleteInv, logGamma } from '../special'
import gamma from './_gamma'
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

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p;
    // Gamma's alpha/beta move to this.c for _q/_generator/_pdf/_cdf, which otherwise delegated
    // to Gamma.prototype and read them off this.p.
    Object.assign(this.c, { alpha: d / p, beta: Math.pow(a, -p) })

    // Validate parameters
    /** @type {*} */
    this.p = { a, d, p }
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

    // Speed-up constants
    Object.assign(this.c, {
      lG0: logGamma(d / p),
      lG1: logGamma((d + 1) / p),
      lG2: logGamma((d + 2) / p),
      lG3: logGamma((d + 3) / p),
      lG4: logGamma((d + 4) / p)
    })
  }

  _q (p) {
    // GeneralizedGamma: X = Y^(1/p_shape) where Y ~ Gamma(d/p_shape, a^-p_shape)
    return Math.pow(gammaLowerIncompleteInv(this.c.alpha, p) / this.c.beta, 1 / this.p.p)
  }

  _generator () {
    // Direct sampling by transforming gamma variate
    return Math.pow(gamma(this.r, this.c.alpha, this.c.beta), 1 / this.p.p)
  }

  _pdf (x) {
    const y = Math.pow(x, this.p.p)
    return this.p.p * Math.pow(x, this.p.p - 1) * Math.exp(this.c.logNorm - this.c.beta * y) * Math.pow(y, this.c.alpha - 1)
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.c.alpha, this.c.beta * Math.pow(x, this.p.p))
  }

  /**
   * @returns {number} First raw moment: a*Gamma((d+1)/p)/Gamma(d/p).
   */
  mean () {
    return this._rawMoment(1)
  }

  /**
   * @returns {number} Second central moment derived from first two raw moments.
   */
  variance () {
    const m1 = this._rawMoment(1)
    return this._rawMoment(2) - m1 * m1
  }

  /**
   * @returns {number} Standardised third central moment from raw moments.
   */
  skewness () {
    const m1 = this._rawMoment(1)
    const m2 = this._rawMoment(2)
    const m3 = this._rawMoment(3)
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis from the first four raw moments.
   */
  kurtosis () {
    const m1 = this._rawMoment(1)
    const m2 = this._rawMoment(2)
    const m3 = this._rawMoment(3)
    const m4 = this._rawMoment(4)
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 ** 4) / (v * v) - 3
  }

  static _fitInit (data) {
    // p=1 collapses to Gamma(d, 1/a): E[X]=a·d, Var[X]=a²·d → d=mean²/var, a=var/mean
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    return [variance / mean, mean ** 2 / variance, 1]
  }

  // Shared by mean/variance/skewness/kurtosis so each doesn't independently recompute the same
  // lower-order raw moments.
  _rawMoment (n) {
    return this.p.a ** n * Math.exp(this.c['lG' + n] - this.c.lG0)
  }
}
