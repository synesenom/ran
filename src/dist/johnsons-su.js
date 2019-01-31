import { erf } from '../special'
import { normal } from './_standard'
import Distribution from './_distribution'

/**
 * Generator for [Johnson's \(S_U\) distribution]{@link https://en.wikipedia.org/wiki/Johnson%27s_SU-distribution}:
 *
 * $$f(x; \gamma, \delta, \lambda, \xi) = \frac{\delta}{\lambda \sqrt{2 \pi}} \frac{e^{-\frac{1}{2}\big[\gamma + \delta \mathrm{sinh}^{-1} \big(\frac{x - \xi}{\lambda}\big)\big]^2}}{\sqrt{1 + \big(\frac{x - \xi}{\lambda}\big)^2}},$$
 *
 * with \(\gamma, \xi \in \mathbb{R}\) and \(\delta, \lambda \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class JohnonsSU
 * @memberOf ran.dist
 * @param {number=} gamma First location parameter. Default value is 0.
 * @param {number=} delta First scale parameter. Default value is 1.
 * @param {number=} lambda Second scale parameter. Default value is 1.
 * @param {number=} xi Second location parameter. Default value is 0.
 * @constructor
 */
export default class extends Distribution {
  constructor (gamma = 0, delta = 1, lambda = 1, xi = 0) {
    super('continuous', arguments.length)
    this.p = { gamma, delta, lambda, xi }
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return this.p.xi + this.p.lambda * Math.sinh((normal() - this.p.gamma) / this.p.delta)
  }

  _pdf (x) {
    let z = (x - this.p.xi) / this.p.lambda
    return this.p.delta * Math.exp(-0.5 * Math.pow(this.p.gamma + this.p.delta * Math.asinh(z), 2)) / (this.p.lambda * Math.sqrt(2 * Math.PI) * Math.sqrt(1 + z * z))
  }

  _cdf (x) {
    return 0.5 * (1 + erf((this.p.gamma + this.p.delta * Math.asinh((x - this.p.xi) / this.p.lambda)) / Math.SQRT2))
  }
}
