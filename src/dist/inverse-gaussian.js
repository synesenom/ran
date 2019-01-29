import { erf } from '../special'
import { normal } from './_standard'
import Distribution from './_distribution'

function phi (x) {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

/**
 * Generator for the Wald or [inverse Gaussian distribution]{@link https://en.wikipedia.org/wiki/Inverse_Gaussian_distribution}:
 *
 * $$f(x; \lambda, \mu) = \bigg[\frac{\lambda}{2 \pi x^3}\bigg]^{1/2} e^{\frac{-\lambda (x - \mu)^2}{2 \mu^2 x}},$$
 *
 * with \(\lambda, \mu \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class InverseGaussian
 * @memberOf ran.dist
 * @param {number=} lambda Shape parameter. Default value is 1.
 * @param {number=} mu Mean of the distribution. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (lambda = 1, mu = 1) {
    super('continuous', arguments.length)
    this.p = { lambda, mu }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
    this.c = [0.5 * this.p.mu / this.p.lambda, Math.exp(2 * lambda / mu)]
  }

  _generator () {
    // Direct sampling
    let nu = normal()

    let y = nu * nu

    let x = this.p.mu + this.c[0] * this.p.mu * y - this.c[0] * Math.sqrt(this.p.mu * y * (4 * this.p.lambda + this.p.mu * y))
    return Math.random() > this.p.mu / (this.p.mu + x) ? this.p.mu * this.p.mu / x : x
  }

  _pdf (x) {
    return Math.sqrt(this.p.lambda / (2 * Math.PI * Math.pow(x, 3))) * Math.exp(-this.p.lambda * Math.pow(x - this.p.mu, 2) / (2 * this.p.mu * this.p.mu * x))
  }

  _cdf (x) {
    let s = Math.sqrt(this.p.lambda / x)

    let t = x / this.p.mu
    return phi(s * (t - 1)) + this.c[1] * phi(-s * (t + 1))
  }
}
