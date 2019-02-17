import Kumaraswamy from './kumaraswamy'

/**
 * Generator for the [power-function distribution]{@link } (also called power-law distribution):
 *
 * $$f(x; a) = a x^{a - 1},$$
 *
 * with \(a \in \mathbb{R}^+\). Support: \(x \in [0, 1]\).
 *
 * @class PowerLaw
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
