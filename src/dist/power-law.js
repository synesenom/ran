import Kumaraswamy from './kumaraswamy'

/**
 * Generator for the [power-law distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.powerlaw.html} (also called power-law distribution):
 *
 * $$f(x; a) = a x^{a - 1},$$
 *
 * with \(a > 0\). Support: \(x \in (0, 1)\). It is a special case of the [Kumaraswamy distribution]{@link #dist.Kumaraswamy}.
 *
 * @class PowerLaw
 * @memberof ran.dist
 * @param {number=} a One plus the exponent of the distribution. Default value is 1.
 * @constructor
 */
export default class extends Kumaraswamy {
  // Special case of Kumaraswamy
  constructor (a = 1) {
    super(a, 1)
  }
}
