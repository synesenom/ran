import F from './f'
import { digamma, hurwitzZeta } from '../special'

/**
 * Generator for [Fisher's z distribution]{@link https://en.wikipedia.org/wiki/Fisher%27s_z-distribution}:
 *
 * $f(x; d_1, d_2) = \sqrt{\frac{d_1^{d_1} d_2^{d_2}}{(d_1 e^{2 x} + d_2)^{d_1 + d_2}}} \frac{2 e^{d_1 x}}{\mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$
 *
 * with $d_1, d_2 > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class FisherZ
 * @memberof ran.dist
 * @constructor
 */
export default class FisherZ extends F {
  // Transformation of F
  /**
   * @param {number} d1 First degree of freedom.
   * @param {number} d2 Second degree of freedom.
   */
  constructor (d1, d2) {
    const d1i = Math.round(d1)
    const d2i = Math.round(d2)
    // F's constructor halves d.o.f. internally when calling Beta; pass full d.o.f.
    // See solutions/correctness/2026-05-18-0534-fisher-z-double-halving-subclass-delegation.md
    super(d1i, d2i)

    this.c.logNorm = Math.LN2 + (this.p.d1 / 2) * Math.log(this.p.d1) + (this.p.d2 / 2) * Math.log(this.p.d2) - this.c.lnBeta

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  // Moments of Z = ½ln(F) derived from the cumulant generating function K(t) = log E[F^{t/2}];
  // cumulants κ_r = K^(r)(0) expressed via polygamma ψ_m = (-1)^{m+1} m! ζ_H(m+1, ·).
  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { d1, d2 } = this.p
    return 0.5 * (Math.log(d2 / d1) + digamma(d1 / 2) - digamma(d2 / 2))
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { d1, d2 } = this.p
    return 0.25 * (hurwitzZeta(2, d1 / 2) + hurwitzZeta(2, d2 / 2))
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { d1, d2 } = this.p
    const k2 = 0.25 * (hurwitzZeta(2, d1 / 2) + hurwitzZeta(2, d2 / 2))
    const k3 = 0.25 * (hurwitzZeta(3, d2 / 2) - hurwitzZeta(3, d1 / 2))
    return k3 / Math.pow(k2, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { d1, d2 } = this.p
    const k2 = 0.25 * (hurwitzZeta(2, d1 / 2) + hurwitzZeta(2, d2 / 2))
    const k4 = 0.375 * (hurwitzZeta(4, d1 / 2) + hurwitzZeta(4, d2 / 2))
    return k4 / (k2 * k2)
  }

  // Blocks Beta's log-barrier (inherited via F): fit() operates in (d1, d2) space. See decisions/0017-beta-fit-penalty.md §3.
  static _fitPenalty () { return 0 }

  static _fitInit (data) {
    // X = ½·ln(F) ⇒ e^{2X} ~ F(d1, d2): seed from F's MOM on the back-transformed data.
    // Clamp the exponent so extreme observations don't overflow to Infinity and poison the mean
    return super._fitInit(data.map(x => Math.exp(Math.min(2 * x, 700))))
  }

  _generator () {
    // Direct sampling by transforming F variate
    return 0.5 * Math.log(super._generator())
  }

  // See solutions/distribution/2026-05-15-1921-fisher-z-pdf-log-space-overflow.md
  _pdf (x) {
    const t = 2 * x
    const logSum = t >= 0
      ? t + Math.log(this.p.d1 + this.p.d2 * Math.exp(-t))
      : Math.log(this.p.d2 + this.p.d1 * Math.exp(t))
    return Math.exp(this.c.logNorm + this.p.d1 * x - ((this.p.d1 + this.p.d2) / 2) * logSum)
  }

  _cdf (x) {
    return super._cdf(Math.exp(2 * x))
  }
}
