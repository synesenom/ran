import Weibull from './weibull'

/**
 * Generator for the [Rayleigh distribution]{@link https://en.wikipedia.org/wiki/Rayleigh_distribution}:
 *
 * $$f(x; \sigma) = \frac{x}{\sigma^2} e^{-\frac{x^2}{2\sigma^2}},$$
 *
 * with \(\sigma > 0\). Support: \(x \ge 0\).
 *
 * @class Rayleigh
 * @memberof ran.dist
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Weibull {
  // Special case of Weibull
  constructor (sigma = 1) {
    super(sigma * Math.SQRT2, 2)
  }
}
