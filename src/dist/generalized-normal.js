import { gammaLowerIncomplete, gammaLowerIncompleteInv } from '../special'
import gamma from './_gamma'
import GeneralizedGamma from './generalized-gamma'
import Distribution from './_distribution'

/**
 * Probability density function for the [generalized normal distribution]{@link https://en.wikipedia.org/wiki/Generalized_normal_distribution}:
 *
 * $f(x; \mu, \alpha, \beta) = \frac{\beta}{2 \alpha \Gamma\big(\frac{1}{\beta}\big)} e^{-\big(\frac{|x - \mu|}{\alpha}\big)^\beta},$
 *
 * where $\mu \in \mathbb{R}$ and $\alpha, \beta > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class GeneralizedNormal
 * @memberof ran.dist
 * @constructor
 */
export default class GeneralizedNormal extends GeneralizedGamma {
  /**
   * @param {number} mu Location paramameter.
   * @param {number} alpha Scale parameter.
   * @param {number} beta Shape parameter.
   */
  constructor (mu, alpha, beta) {
    super(alpha, 1, beta)

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p.
    // GeneralizedGamma's own fix (this file's parent) already replaces its this.p with its own
    // { a, d, p } keys — no leaked Gamma-space alpha/beta to collide with here, so alpha/beta no
    // longer need the alpha2/beta2 rename.
    this.p = { mu, alpha, beta }
    Distribution.validate({ mu, alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _q (p) {
    // GeneralizedNormal folds GeneralizedGamma over mu; invert the fold then shift by mu.
    // this.c.alpha/this.c.beta are GeneralizedGamma's own Gamma-space constants (unaffected by
    // this class); the GG-level shape exponent equals this class's own natural beta.
    const gg = Math.pow(gammaLowerIncompleteInv(this.c.alpha, p > 0.5 ? 2 * p - 1 : 1 - 2 * p) / this.c.beta, 1 / this.p.beta)
    return p > 0.5 ? this.p.mu + gg : this.p.mu - gg
  }

  // GeneralizedGamma.prototype._generator/_pdf/_cdf read this.p.p (GeneralizedGamma's own natural
  // shape key, numerically equal to this class's own beta) — no longer present once this.p is
  // replaced with { mu, alpha, beta } — so these are inlined directly against this.c.alpha/
  // this.c.beta/this.c.logNorm (GeneralizedGamma's/Gamma's own cached constants, unaffected by
  // this class) and this.p.beta, instead of delegating to super.
  _generator () {
    // Transforming generalized gamma variate
    return (this.r.next() > 0.5 ? 1 : -1) * Math.pow(gamma(this.r, this.c.alpha, this.c.beta), 1 / this.p.beta) + this.p.mu
  }

  _pdf (x) {
    const y = Math.abs(x - this.p.mu)
    const t = Math.pow(y, this.p.beta)
    return this.p.beta * Math.pow(y, this.p.beta - 1) * Math.exp(this.c.logNorm - this.c.beta * t) * Math.pow(t, this.c.alpha - 1) / 2
  }

  _cdf (x) {
    const y = Math.abs(x - this.p.mu)
    return 0.5 * (1 + Math.sign(x - this.p.mu) * gammaLowerIncomplete(this.c.alpha, this.c.beta * Math.pow(y, this.p.beta)))
  }

  /**
   * @returns {number} Location parameter.
   */
  mean () {
    return this.p.mu
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    // lG0/lG2 = logGamma(1/beta)/logGamma(3/beta), already cached by GeneralizedGamma's constructor.
    return this.p.alpha ** 2 * Math.exp(this.c.lG2 - this.c.lG0)
  }

  /**
   * @returns {number} Zero (the generalized normal distribution is symmetric about mu).
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} Excess kurtosis of the distribution.
   */
  kurtosis () {
    return Math.exp(this.c.lG4 + this.c.lG0 - 2 * this.c.lG2) - 3
  }

  static _fitInit (data) {
    // Seed at beta=2 (normal special case) with MOM estimates; beta's MOM inversion requires log-moment ratios unavailable from mean/std alone
    const n = data.length
    const mu = data.reduce((s, x) => s + x, 0) / n
    const alpha = Math.sqrt(data.reduce((s, x) => s + (x - mu) ** 2, 0) / n) || 1
    return [mu, alpha, 2]
  }
}
