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
