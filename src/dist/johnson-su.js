import Normal from './normal'
import Distribution from './_distribution'

/**
 * Generator for [Johnson's \(S_U\) distribution]{@link https://en.wikipedia.org/wiki/Johnson%27s_SU-distribution}:
 *
 * $$f(x; \gamma, \delta, \lambda, \xi) = \frac{\delta}{\lambda \sqrt{2 \pi}} \frac{e^{-\frac{1}{2}\big[\gamma + \delta \mathrm{sinh}^{-1} z \big]^2}}{\sqrt{1 + z^2}},$$
 *
 * with \(\gamma, \xi \in \mathbb{R}\), \(\delta, \lambda > 0\) and \(z = \frac{x - \xi}{\lambda}\). Support: \(x \in \mathbb{R}\).
 *
 * @class JohnsonSU
 * @memberOf ran.dist
 * @param {number=} gamma First location parameter. Default value is 0.
 * @param {number=} delta First scale parameter. Default value is 1.
 * @param {number=} lambda Second scale parameter. Default value is 1.
 * @param {number=} xi Second location parameter. Default value is 0.
 * @constructor
 */
export default class extends Normal {
  // Transformation of normal distribution
  constructor (gamma = 0, delta = 1, lambda = 1, xi = 0) {
    super()

    // Validate parameters
    this.p = Object.assign(this.p, { gamma, delta, lambda, xi })
    Distribution.validate({ gamma, delta, lambda, xi }, [
      'delta > 0',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return this.p.xi + this.p.lambda * Math.sinh((super._generator() - this.p.gamma) / this.p.delta)
  }

  _pdf (x) {
    const z = (x - this.p.xi) / this.p.lambda
    return this.p.delta * super._pdf(this.p.gamma + this.p.delta * Math.asinh(z)) / (this.p.lambda * Math.sqrt(1 + z * z))
  }

  _cdf (x) {
    return super._cdf(this.p.gamma + this.p.delta * Math.asinh((x - this.p.xi) / this.p.lambda))
  }

  _q (p) {
    return this.p.xi + this.p.lambda * Math.sinh((super._q(p) - this.p.gamma) / this.p.delta)
  }
}
