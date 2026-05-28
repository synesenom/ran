import Kumaraswamy from './kumaraswamy'

/**
 * Probability density function for the [power-law distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.powerlaw.html} (also called power-law distribution):
 *
 * $f(x; a) = a x^{a - 1},$
 *
 * with $a > 0$. Support: $x \in (0, 1)$. It is a special case of the [Kumaraswamy distribution]{@link #dist.Kumaraswamy}.
 *
 * @class PowerLaw
 * @memberof ran.dist
 * @constructor
 */
export default class PowerLaw extends Kumaraswamy {
  // Special case of Kumaraswamy.
  /**
   * @param {number} a One plus the exponent of the distribution.
   */
  constructor (a) {
    super(a, 1)
  }

  static _fitInit (data) {
    // f(x)=a·x^{a−1} → E[log X] = −1/a; MLE is a = −1/mean(log x), closed-form
    const n = data.length
    const logMean = data.reduce((s, x) => s + Math.log(x), 0) / n
    return [Math.max(-1 / logMean, 0.1)]
  }
}
