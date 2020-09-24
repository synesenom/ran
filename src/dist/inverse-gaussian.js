import { erf, erfc } from '../special/error'
import { normal } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the Wald or [inverse Gaussian distribution]{@link https://en.wikipedia.org/wiki/Inverse_Gaussian_distribution}:
 *
 * $$f(x; \lambda, \mu) = \bigg[\frac{\lambda}{2 \pi x^3}\bigg]^{1/2} e^{\frac{-\lambda (x - \mu)^2}{2 x \mu^2}},$$
 *
 * with \(\mu, \lambda > 0\). Support: \(x > 0\).
 *
 * @class InverseGaussian
 * @memberof ran.dist
 * @param {number=} mu Mean of the distribution. Default value is 1.
 * @param {number=} lambda Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 1, lambda = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { mu, lambda }
    Distribution.validate({ mu, lambda }, [
      'mu > 0',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      0.5 * mu / lambda,
      Math.exp(2 * lambda / mu),
      Math.sqrt(lambda / (mu * mu))
    ]
  }

  _generator () {
    // Direct sampling
    const nu = normal(this.r)

    const y = nu * nu

    const x = this.p.mu + this.c[0] * this.p.mu * y - this.c[0] * Math.sqrt(this.p.mu * y * (4 * this.p.lambda + this.p.mu * y))
    return this.r.next() > this.p.mu / (this.p.mu + x) ? this.p.mu * this.p.mu / x : x
  }

  _pdf (x) {
    return Math.sqrt(this.p.lambda / (2 * Math.PI * Math.pow(x, 3))) * Math.exp(-this.p.lambda * Math.pow(x - this.p.mu, 2) / (2 * this.p.mu * this.p.mu * x))
  }

  _cdf (x) {
    const s = Math.sqrt(this.p.lambda / x)
    const st = Math.sqrt(x) * this.c[2]
    const z = erf(Math.SQRT1_2 * (st - s))

    // Handle 1 - z << 1 case
    if (1 - z > Number.EPSILON) {
      return Math.min(1, 0.5 * (1 + z + this.c[1] * erfc(Math.SQRT1_2 * (st + s))))
    } else {
      return Math.min(1, 0.5 * (erfc(Math.SQRT1_2 * (s - st)) + this.c[1] * erfc(Math.SQRT1_2 * (st + s))))
    }
  }
}
