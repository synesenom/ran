import Distribution from './_distribution'
import { digamma, hurwitzZeta } from '../special'

/**
 * Probability density function for the [generalized logistic distribution]{@link https://en.wikipedia.org/wiki/Generalized_logistic_distribution}:
 *
 * $f(x; \mu, s, c) = \frac{c e^{-z}}{s (1 + e^{-z})^{c + 1}},$
 *
 * with $z = \frac{x - \mu}{s}$, $\mu \in \mathbb{R}$ and $s, c > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class GeneralizedLogistic
 * @memberof ran.dist
 * @constructor
 */
export default class GeneralizedLogistic extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} s Scale parameter.
   * @param {number} c Shape parameter.
   */
  constructor (mu, s, c) {
    super('continuous', 3)

    // Validate parameters
    this.p = { mu, s, c }
    Distribution.validate({ mu, s, c }, [
      's > 0',
      'c > 0'
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

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = Math.exp(-(x - this.p.mu) / this.p.s)
    return Number.isFinite(z * z)
      ? this.p.c * z / (this.p.s * Math.pow(1 + z, this.p.c + 1))
      : 0
  }

  _cdf (x) {
    return 1 / Math.pow(1 + Math.exp(-(x - this.p.mu) / this.p.s), this.p.c)
  }

  _q (p) {
    return this.p.mu - this.p.s * Math.log(Math.pow(p, -1 / this.p.c) - 1)
  }

  /**
   * @returns {number} The mean, $\mu + s(\psi(c) - \psi(1))$.
   */
  mean () {
    return this.p.mu + this.p.s * (digamma(this.p.c) - digamma(1))
  }

  /**
   * @returns {number} The variance, $s^2(\psi'(1) + \psi'(c))$.
   */
  variance () {
    return this.p.s * this.p.s * (Math.PI * Math.PI / 6 + hurwitzZeta(2, this.p.c))
  }

  /**
   * @returns {number} The skewness via the third cumulant $\kappa_3 = 2s^3(\zeta(3,1) - \zeta(3,c))$.
   */
  skewness () {
    const { s, c } = this.p
    const kappa2 = s * s * (Math.PI * Math.PI / 6 + hurwitzZeta(2, c))
    // κ₃ = s³(ψ''(c) − ψ''(1)) = 2s³(ζ(3,1) − ζ(3,c))
    const kappa3 = 2 * s * s * s * (hurwitzZeta(3, 1) - hurwitzZeta(3, c))
    return kappa3 / Math.pow(kappa2, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis via the fourth cumulant $\kappa_4 = 6s^4(\zeta(4,c) + \zeta(4,1))$.
   */
  kurtosis () {
    const { s, c } = this.p
    const kappa2 = s * s * (Math.PI * Math.PI / 6 + hurwitzZeta(2, c))
    // κ₄ = s⁴(ψ'''(c) + ψ'''(1)) = 6s⁴(ζ(4,c) + ζ(4,1))
    const kappa4 = 6 * s * s * s * s * (hurwitzZeta(4, c) + hurwitzZeta(4, 1))
    return kappa4 / (kappa2 * kappa2)
  }

  static _fitInit (data) {
    // At c=1 (logistic special case) Var[X] = pi^2 s^2 / 3 and mean = mu give the same MOM as Logistic
    const n = data.length
    const mu = data.reduce((s, x) => s + x, 0) / n
    const v = data.reduce((s, x) => s + (x - mu) ** 2, 0) / n
    return [mu, Math.max(Math.sqrt(3 * v) / Math.PI, 1e-3), 1]
  }
}
