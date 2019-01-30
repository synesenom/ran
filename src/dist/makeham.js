import { lambertW } from '../special'
import Distribution from './_distribution'

/**
 * Generator for the [Makeham distribution]{@link https://en.wikipedia.org/wiki/Gompertz%E2%80%93Makeham_law_of_mortality}
 * (also known as Gompertz-Makeham distribution):
 *
 * $$f(x; \alpha, \beta, \lambda) = (\alpha e^{\beta x} + \lambda) \exp{-\lambda x},$$
 *
 * with \(\alpha, \beta, \lambda \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class Makeham
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @param {number=} lambda Scale parameter. Default value is 1.
 */
export default class extends Distribution {
  constructor (alpha = 1, beta = 1, lambda = 1) {
    super('continuous', arguments.length)
    this.p = { alpha, beta, lambda }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    let u = Math.random()
    return this.p.alpha / (this.p.beta * this.p.lambda) - Math.log(u) / this.p.lambda -
      lambertW(this.p.alpha * Math.exp(this.p.alpha / this.p.lambda) * Math.pow(u, -this.p.beta / this.p.lambda) / this.p.lambda) / this.p.beta
  }

  _pdf (x) {
    let y = Math.exp(this.p.beta * x)
    return (this.p.alpha * y + this.p.lambda) * Math.exp(-this.p.lambda * x - this.p.alpha * (y - 1) / this.p.beta)
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.lambda * x - this.p.alpha * (Math.exp(this.p.beta * x) - 1) / this.p.beta)
  }
}
