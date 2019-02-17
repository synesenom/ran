import { lambertW } from '../special'
import Distribution from './_distribution'

/**
 * Generator for the [Makeham distribution]{@link https://en.wikipedia.org/wiki/Gompertz%E2%80%93Makeham_law_of_mortality}
 * (also known as Gompertz-Makeham distribution):
 *
 * $$f(x; \alpha, \beta, \lambda) = (\alpha e^{\beta x} + \lambda) \exp\Big[{-\lambda x - \frac{\alpha}{\beta}(e^{\beta x} - 1)}\Big],$$
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

    // Speed up constants
    this.c = [
      alpha / (beta * lambda),
      alpha * Math.exp(alpha / lambda) / lambda,
      -beta / lambda
    ]
  }

  _generator () {
    // Inverse transform sampling
    let u = Math.random()
    let z = this.c[1] * Math.pow(u, this.c[2])

    // Handle z >> 1 case
    let w = lambertW(z)
    if (!isFinite(w)) {
      let t = Math.log(this.c[1]) + this.c[2] * Math.log(u)
      return this.c[0] - Math.log(u) / this.p.lambda -
        (t - Math.log(t)) / this.p.beta
    } else {
      return this.c[0] - Math.log(u) / this.p.lambda -
        w / this.p.beta
    }
  }

  _pdf (x) {
    let y = Math.exp(this.p.beta * x)

    // Handle y >> 1 cases
    if (isFinite(Math.exp(y))) {
      return (this.p.alpha * y + this.p.lambda) * Math.exp(-this.p.lambda * x - this.p.alpha * (y - 1) / this.p.beta)
    } else {
      return 0
    }
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.lambda * x - this.p.alpha * (Math.exp(this.p.beta * x) - 1) / this.p.beta)
  }
}
