import StudentT from './student-t'
import Distribution from './_distribution'

/**
 * Generator for [Student's Z distribution]{@link http://mathworld.wolfram.com/Studentsz-Distribution.html}:
 *
 * $$f(x; n) = \frac{\Gamma\Big(\frac{n}{2}\Big)}{\sqrt{\pi} \Gamma\Big(\frac{n - 1}{2}\Big)} (1 + x^2)^{-\frac{n}{2}},$$
 *
 * with \(n > 1\). Support: \(x \in \mathbb{R}\).
 *
 * @class StudentZ
 * @memberOf ran.dist
 * @param {number=} n Degrees of freedom. Default value is 2.
 * @constructor
 */
export default class extends StudentT {
  constructor (n = 2) {
    // Validate parameter
    Distribution.validate({ n }, [
      'n > 1'
    ])

    super(n - 1)
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
