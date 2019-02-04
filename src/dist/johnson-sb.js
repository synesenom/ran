import Normal from './normal'

/**
 * Generator for [Johnson's \(S_B\) distribution]{@link https://en.wikipedia.org/wiki/Johnson%27s_SU-distribution#Johnson's_SB-distribution}:
 *
 * $$f(x; \gamma, \delta, \lambda, \xi) = \frac{\delta \lambda}{\sqrt{2 \pi} z (\lambda - z)} e^{-\frac{1}{2}\big[\gamma + \delta \ln \frac{z}{\lambda - z}\big]^2},$$
 *
 * with \(\gamma, \xi \in \mathbb{R}\), \(\delta, \lambda \in \mathbb{R}^+\) and \(z = x - \xi\). Support: \(x \in (\xi, \xi + \lambda)\).
 *
 * @class JohnsonSB
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
    this.p = Object.assign({ gamma, delta, lambda, xi }, this.p)
    this.s = [{
      value: this.p.xi,
      closed: false
    }, {
      value: this.p.xi + this.p.lambda,
      closed: false
    }]
  }
  _generator () {
    // Direct sampling by transforming normal variate
    return this.p.xi + this.p.lambda / (1 + Math.exp(-(super._generator() - this.p.gamma) / this.p.delta))
  }

  _pdf (x) {
    let z = x - this.p.xi
    return this.p.delta * this.p.lambda * super._pdf(this.p.gamma + this.p.delta * Math.log(z / (this.p.lambda - z))) / (z * (this.p.lambda - z))
  }

  _cdf (x) {
    // return super._cdf(this.p.gamma + this.p.delta * Math.asinh((x - this.p.xi) / this.p.lambda))
    let z = x - this.p.xi
    return super._cdf(this.p.gamma + this.p.delta * Math.log(z / (this.p.lambda - z)))
  }
}
