import Normal  from './normal'
import Distribution from './_distribution'

/**
 * Generator for the [truncated normal distribution]{@link https://en.wikipedia.org/wiki/Truncated_normal_distribution}:
 *
 * $$f(x; \mu, \sigma, a, b) = \frac{1}{\sigma} \frac{\phi(\xi)}{\Phi(\beta) - \Phi(\alpha)},$$
 *
 * where $\xi = \frac{x - \mu}{\sigma}, \alpha = \frac{a - \mu}{\sigma}$ and $\beta = \frac{b - \mu}{\sigma}$.
 * The functions $\phi$ and $\Phi$ denote the probability density and cumulative distribution functions of the normal
 * distribution. Finally, $\mu \in \mathbb{R}$, $\sigma > 0$ and $b > a$. Support: $x \in [a, b]$.
 *
 * @class TruncatedNormal
 * @memberof ran.dist
 * @param {number=} mu Mean of the underlying normal distribution. Default value is 0.
 * @param {number=} sigma Variance of the underlying normal distribution. Default value is 1.
 * @param {number=} a Lower boundary of the support. Default value is 0.
 * @param {number=} b Upper boundary of the support. Default value is 1.
 * @constructor
 */
export default class extends Normal {
  constructor (mu = 0, sigma = 1, a = 0, b = 1) {
    super(mu, sigma)

    // Validate parameters.
    this.p = { mu, sigma, a, b }
    Distribution.validate({ mu, sigma, a, b }, [
      'sigma > 0',
      'b > a'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]

    // Speed-up constants.
    this.c2 = [
      super._cdf(a),
      super._cdf(b) - super._cdf(a)
    ]
  }

  _generator () {
    return this._q(this.r.next())
  }

  _pdf (x) {
    return super._pdf(x) / this.c2[1]
  }

  _cdf (x) {
    return (super._cdf(x) - this.c2[0]) / this.c2[1]
  }

  _q (p) {
    return super._q(this.c2[0] + p * this.c2[1])
  }
}
