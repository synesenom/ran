import Distribution from './_distribution'

/**
 * Probability mass function for the [Flory-Schulz distribution]{@link https://en.wikipedia.org/wiki/Flory%E2%80%93Schulz_distribution}:
 *
 * $f(k; a) = a^2 k (1 - a)^{k - 1},$
 *
 * with $a \in (0, 1)$. Support: $k \in \mathbb{N}^+$.
 *
 * @class FlorySchulz
 * @memberof ran.dist
 * @constructor
 */
export default class FlorySchulz extends Distribution {
  /**
   * @param {number} a Shape parameter.
   */
  constructor (a) {
    super('discrete', 1)

    // Validate parameters
    this.p = { a }
    Distribution.validate({ a }, [
      'a > 0', 'a < 1'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: true
    }]

    // Speed-up constants
    this.c = {
      oneMinusA: 1 - a,
      lnOneMinusA: Math.log1p(-a)
    }
  }

  static _fitInit (data) {
    // E[X] = 2/a; solving gives a = 2/mean.
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [Math.max(0.01, Math.min(0.99, 2 / mean))]
  }

  _generator () {
    // FlorySchulz(a) = G1 + G2 + 1, G_i ~ Geom(a) (failures before success).
    // Geom(a) inverse-CDF: floor(log(U) / log(1-a)), O(1) regardless of a.
    const g1 = Math.floor(Math.log(this.r.next()) / this.c.lnOneMinusA)
    const g2 = Math.floor(Math.log(this.r.next()) / this.c.lnOneMinusA)
    return g1 + g2 + 1
  }

  _pdf (x) {
    return this.p.a * this.p.a * x * Math.pow(this.c.oneMinusA, x - 1)
  }

  _cdf (x) {
    // log1p/expm1 avoids 1-near-1 cancellation in 1-(1-a)^k*(1+ka) when a→0
    const kLnOma = x * this.c.lnOneMinusA
    return -Math.expm1(kLnOma) - Math.exp(kLnOma) * x * this.p.a
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    // X = G1 + G2 + 1 where G_i ~ Geometric(a) (failures before success); E[G_i]=(1-a)/a
    return (2 - this.p.a) / this.p.a
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    // Var[G_i] = (1-a)/a²; two independent copies sum
    return 2 * (1 - this.p.a) / (this.p.a * this.p.a)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const a = this.p.a
    // Skew scales as 1/√n for sum of n IID; skew[G_i]=(2-a)/√(1-a)
    return (2 - a) / Math.sqrt(2 * (1 - a))
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const a = this.p.a
    // Excess kurtosis scales as 1/n for sum of n IID; kurt[G_i]=6+a²/(1-a)
    return 3 + a * a / (2 * (1 - a))
  }
}
