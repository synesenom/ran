import StudentT from './student-t'
import Distribution from './_distribution'

/**
 * Generator for [Student's Z distribution]{@link http://mathworld.wolfram.com/Studentsz-Distribution.html}:
 *
 * $f(x; n) = \frac{\Gamma\Big(\frac{n}{2}\Big)}{\sqrt{\pi} \Gamma\Big(\frac{n - 1}{2}\Big)} (1 + x^2)^{-\frac{n}{2}},$
 *
 * with $n > 1$. Support: $x \in \mathbb{R}$.
 *
 * @class StudentZ
 * @memberof ran.dist
 * @constructor
 */
export default class StudentZ extends StudentT {
  /**
   * @param {number} n Degrees of freedom.
   */
  constructor (n) {
    // Validate parameter
    Distribution.validate({ n }, [
      'n > 1'
    ])

    super(n - 1)

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p
    // this.c.nu = n-1, this.c.sqrtNu = sqrt(n-1) set by StudentT constructor remain valid
    this.p = { n }
  }

  static _fitInit (data) {
    // Z = T/√ν with ν = n−1 ⇒ Var[Z] = 1/(n−3); invert for n, defaulting when variance is degenerate
    const len = data.length
    const mean = data.reduce((s, x) => s + x, 0) / len
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / len
    return [variance > 0 ? 1 / variance + 3 : 10]
  }

  // Moment overrides shadow StudentT's, which read this.p.nu — replaced here by this.p.n;
  // Z = T(n-1)/sqrt(n-1) shifts the t thresholds by one and rescales by 1/(n-1)
  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.p.n > 2 ? 0 : NaN
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { n } = this.p
    if (n > 3) return 1 / (n - 3)
    // 2 < n <= 3: second moment diverges; n <= 2: mean undefined, so variance undefined
    return n > 2 ? Infinity : NaN
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    // symmetric +/- divergence below the threshold has no signed limit: NaN, never Infinity
    return this.p.n > 4 ? 0 : NaN
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { n } = this.p
    if (n > 5) return 6 / (n - 5)
    // 3 < n <= 5: fourth moment diverges over finite variance; n <= 3: variance undefined
    return n > 3 ? Infinity : NaN
  }

  _generator () {
    // Z = T(ν)/√ν where ν = n-1; super._generator() uses this.c.nu via StudentT
    return super._generator() / this.c.sqrtNu
  }

  _pdf (x) {
    return super._pdf(x * this.c.sqrtNu) * this.c.sqrtNu
  }

  _cdf (x) {
    return super._cdf(x * this.c.sqrtNu)
  }
}
