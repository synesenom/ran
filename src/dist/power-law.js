import Kumaraswamy from './kumaraswamy'

/**
 * Generator for the [power-function distribution]{@link } (also called power-law distribution):
 *
 * $$f(x; a) = a x^{a - 1},$$
 *
 * with \(a > 0\). Support: \(x \in [0, 1]\). It is a special case of the [Kumaraswamy distribution]{@link #dist.Kumaraswamy}.
 *
 * @class Power
 * @memberOf ran.dist
 * @param {number=} a One plus the exponent of the distribution. Default value is 1.
 * @constructor
 */
export default class extends Kumaraswamy {
  // Special case of Kumaraswamy
  constructor (a = 1) {
    super(a, 1)
  }
}
