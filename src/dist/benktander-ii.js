import { lambertW } from '../special'
import Distribution from './_distribution'

/**
 * Generator for the [Benktander type II distribution]{@link https://en.wikipedia.org/wiki/Benktander_type_II_distribution}:
 *
 * $$f(x; \alpha, \beta, \sigma) = \bigg(\frac{\alpha}{x} + \frac{2 \beta \ln \frac{x}{\sigma}}{x}\bigg) e^{-\alpha \ln \frac{x}{\sigma} - \beta \ln^2 \frac{x}{\sigma}},$$
 *
 * with \(a \in \mathbb{R}^+\) and \(b \in (0, 1]\). Support: \(x \in [1, \infty)\).
 *
 * @class BenktanderTypeII
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
      value: null,
      closed: false
    }]
    this.c = [(1 - this.p.b) / this.p.a, Math.exp(-a / b)]
  }

  _generator () {
    return Math.pow(this.c[0] * lambertW(Math.pow(Math.random() * this.c[1], this.p.b / (this.p.b - 1)) / this.c[0]), 1 / this.p.b)
  }

  _pdf (x) {
    let y = Math.pow(x, this.p.b)
    return Math.exp(this.p.a * (1 - y) / this.p.b) * Math.pow(x, this.p.b - 2) * (this.p.a * y - this.p.b + 1)
  }

  _cdf (x) {
    return 1 - Math.pow(x, this.p.b - 1) * Math.exp(this.p.a * (1 - Math.pow(x, this.p.b)) / this.p.b)
  }
}
