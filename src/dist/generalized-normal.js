import GeneralizedGamma from './generalized-gamma'
import Distribution from './_distribution'

/**
 * Generator for the [generalized normal distribution]{@link }:
 *
 * $$f(x; \mu, \alpha, \beta) = \frac{\beta}{2 \alpha \Gamma\bigg(\frac{1}{\beta}\bigg)} e^{-\big(\frac{x - \mu}{\alpha}\big)^\beta},$$
 *
 * where \(\mu \in \mathbb{R}\) and \(\alpha, \beta > 0\). Support: \(x \in \mathbb{R\). It is also a special case of the
 * [generalized gamma distribution]{@link #dist.GeneralizedGamma}.
 *
 * @class GeneralizedNormal
 * @memberOf ran.dist
 * @param {number=} mu Location paramameter. Default value is 0.
 * @param {number=} alpha Scale parameter. Default value is 1.
 * @param {number=} beta Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends GeneralizedGamma {
  constructor (mu = 0, alpha = 1, beta = 1) {
    super(alpha, 1, beta)

    // Validate parameters
    this.p = Object.assign(this.p, { mu, alpha2: alpha, beta2: beta })
    Distribution._validate({ mu, alpha, beta }, [
      'alpha > 0',
      'beta > 0'
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
    // Transforming generalized gamma variate
    return (this.r.next() > 0.5 ? 1 : -1) * Math.abs(super._generator()) + this.p.mu
  }

  _pdf (x) {
    return super._pdf(Math.abs(x - this.p.mu)) / 2
  }

  _cdf (x) {
    return 0.5 * (1 + Math.sign(x - this.p.mu) * super._cdf(Math.abs(x - this.p.mu)))
  }
}
