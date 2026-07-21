import { gammaLowerIncomplete, gammaLowerIncompleteInv } from '../special'
import gamma from './_gamma'
import powell from '../algorithms/powell'
import Gamma from './gamma'
import Distribution from './_distribution'

/**
 * Probability density function for the [Erlang distribution]{@link https://en.wikipedia.org/wiki/Erlang_distribution}:
 *
 * $f(x; k, \lambda) = \frac{\lambda^k x^{k - 1} e^{-\lambda x}}{(k - 1)!},$
 *
 * where $k \in \mathbb{N}^+$ and $\lambda > 0$. Support: $x \ge 0$.
 *
 * @class Erlang
 * @memberof ran.dist
 * @constructor
 */
export default class Erlang extends Gamma {
  // Special case of gamma
  /**
   * @param {number} k Shape parameter. It is rounded to the nearest integer.
   * @param {number} lambda Rate parameter.
   */
  constructor (k, lambda) {
    const ki = Math.round(k)
    super(ki, lambda)

    // Validate parameters
    Distribution.validate({ k: ki, lambda }, [
      'k > 0',
      'lambda > 0'
    ])

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p
    this.p = { k: ki, lambda }
    Object.assign(this.c, { alpha: ki, beta: lambda })
  }

  _generator () {
    return gamma(this.r, this.c.alpha, this.c.beta)
  }

  _pdf (x) {
    return Math.exp(this.c.logNorm - this.c.beta * x) * Math.pow(x, this.c.alpha - 1)
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.c.alpha, this.c.beta * x)
  }

  _q (p) {
    return gammaLowerIncompleteInv(this.c.alpha, p) / this.c.beta
  }

  /**
   * @returns {number} Shape divided by rate.
   */
  mean () {
    return this.c.alpha / this.c.beta
  }

  /**
   * @returns {number} Shape divided by squared rate.
   */
  variance () {
    return this.c.alpha / this.c.beta ** 2
  }

  /**
   * @returns {number} Two divided by the square root of the shape.
   */
  skewness () {
    return 2 / Math.sqrt(this.c.alpha)
  }

  /**
   * @returns {number} Six divided by the shape.
   */
  kurtosis () {
    return 6 / this.c.alpha
  }

  static _fitInit (data) {
    // MOM: E[X]=k/λ, Var[X]=k/λ² → k = round(mean²/var), λ = mean/var
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    return [Math.max(1, Math.round(mean ** 2 / variance)), mean / variance]
  }

  /**
   * @param {number[]} data Array of sample values.
   * @returns {Erlang} Fitted distribution.
   */
  static fit (data) {
    const Cls = this
    const [kHat, lambda0] = Cls._fitInit(data)
    const kSeed = Math.round(kHat)
    const w = Distribution._adaptiveHalfWidth(k => { try { return new Cls(k, lambda0).lnL(data) } catch (_) { return -Infinity } }, kSeed, 1)
    const kLo = Math.max(1, kSeed - w)
    const kHi = kSeed + w
    let bestK = kSeed
    let bestLambda = lambda0
    let bestLnL = -Infinity
    // Warm-start: consecutive integers share nearly the same optimal λ
    let warmLambda = lambda0
    for (let k = kLo; k <= kHi; k++) {
      const result = powell(
        ([lambda]) => {
          try {
            const v = -new Cls(k, lambda).lnL(data)
            return isNaN(v) ? Infinity : v
          } catch (_) {
            return Infinity
          }
        },
        [warmLambda],
        { maxIter: 50, tol: 1e-4 }
      )
      try {
        const lnL = new Cls(k, result[0]).lnL(data)
        warmLambda = result[0]
        if (lnL > bestLnL) { bestLnL = lnL; bestK = k; bestLambda = result[0] }
      } catch (_) {}
    }
    return new Cls(bestK, bestLambda)
  }
}
