import Normal from './normal'

/**
 * Generator for the [half-normal distribution]{@link https://en.wikipedia.org/wiki/Half-normal_distribution}:
 *
 * $$f(x; \sigma) = \frac{\sqrt{2}}{\sigma\sqrt{\pi}} e^{-\frac{x^2}{2\sigma^2}},$$
 *
 * with \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class HalfNormal
 * @memberOf ran.dist
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Normal {
  // Transformation of normal distribution
  constructor (sigma = 1) {
    super(0, sigma)
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return Math.abs(super._generator())
  }

  _pdf (x) {
    return 2 * super._pdf(x)
  }

  _cdf (x) {
    return 2 * super._cdf(x) - 1
  }
}
