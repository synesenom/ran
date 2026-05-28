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
  }

  static _fitInit (data) {
    // Z = T/√ν with ν = n−1 ⇒ Var[Z] = 1/(n−3); invert for n, defaulting when variance is degenerate
    const len = data.length
    const mean = data.reduce((s, x) => s + x, 0) / len
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / len
    return [variance > 0 ? 1 / variance + 3 : 10]
  }

  _generator () {
    return super._generator() / Math.sqrt(this.p.nu)
  }

  _pdf (x) {
    return super._pdf(x * Math.sqrt(this.p.nu)) * Math.sqrt(this.p.nu)
  }

  _cdf (x) {
    return super._cdf(x * Math.sqrt(this.p.nu))
  }
}
