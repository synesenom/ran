import lambertW from '../special/lambert-w'
import Distribution from './_distribution'

/**
 * Generator for the [Benktander type II distribution]{@link https://en.wikipedia.org/wiki/Benktander_type_II_distribution}:
 *
 * $$f(x; a, b) = e^{\frac{a}{b}(1 - x^b)} x^{b-2} (ax^b - b + 1),$$
 *
 * with \(a \in \mathbb{R}^+\) and \(b \in (0, 1]\). Support: \(x \in [1, \infty)\).
 *
 * @class BenktanderII
 * @memberOf ran.dist
 * @param {number=} a Scale parameter. Default value is 1.
 * @param {number=} b Shape parameter. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 1, b = 0.5) {
    super('continuous', arguments.length)
    this.p = { a, b }
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
    this.c = [
      (1 - b) / a,
      Math.exp(-a / b),
      b / (b - 1),
      Math.log(a / (1 - b)) + a / (1 - b)
    ]
    this.eps = 1 - b
  }

  _generator () {
    // Inverse transform sampling
    let u = this.r.next()

    if (this.eps < Number.EPSILON) {
      // b = 1
      return 1 - Math.log(u) / this.p.a
    }

    // Check if b is too close to 1
    let w = lambertW(Math.pow(u * this.c[1], this.c[2]) / this.c[0])
    if (!isFinite(w)) {
      // 1 - b << 1, use logarithms
      let l1 = this.c[3] + this.c[2] * Math.log(u)
      let l2 = Math.log(l1)

      // W(x) ~= ln(x) - ln ln(x) - ln(x) / (ln ln(x))
      return Math.pow(this.c[0] * (l1 - l2 + l2 / l1), 1 / this.p.b)
    } else {
      // All other cases
      return Math.pow(this.c[0] * w, 1 / this.p.b)
    }
  }

  _pdf (x) {
    if (this.eps < Number.EPSILON) {
      // b = 1
      return this.p.a * Math.exp(this.p.a * (1 - x))
    }

    // All other cases
    let y = Math.pow(x, this.p.b)
    return Math.exp(this.p.a * (1 - y) / this.p.b) * Math.pow(x, this.p.b - 2) * (this.p.a * y - this.p.b + 1)
  }

  _cdf (x) {
    if (this.eps < Number.EPSILON) {
      // b = 1
      return 1 - Math.exp(this.p.a * (1 - x))
    }

    // All other cases
    return 1 - Math.pow(x, this.p.b - 1) * Math.exp(this.p.a * (1 - Math.pow(x, this.p.b)) / this.p.b)
  }

  _q(p) {
    if (this.eps < Number.EPSILON) {
      // b = 1
      return 1 - Math.log(p) / this.p.a
    }

    // Check if b is too close to 1
    let w = lambertW(Math.pow(p * this.c[1], this.c[2]) / this.c[0])
    if (!isFinite(w)) {
      // 1 - b << 1, use logarithms
      let l1 = this.c[3] + this.c[2] * Math.log(p)
      let l2 = Math.log(l1)

      // W(x) ~= ln(x) - ln ln(x) - ln(x) / (ln ln(x))
      return Math.pow(this.c[0] * (l1 - l2 + l2 / l1), 1 / this.p.b)
    } else {
      // All other cases
      return Math.pow(this.c[0] * w, 1 / this.p.b)
    }
  }
}
