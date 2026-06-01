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

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // f(x)=a·x^{a−1} on (0,1) → E[log X] = −1/a; the exact MLE is a = −1/mean(log x). For in-support
    // data every log(x) < 0 so mean(log x) < 0 and a > 0 always; guard only the degenerate empty case.
    // The MLE is biased in finite samples (cf. Pareto exponent, Newman 2006); see #626 for a correction.
    const n = data.length
    const logMean = data.reduce((s, x) => s + Math.log(x), 0) / n
    const a = -1 / logMean
    return [a > 0 && Number.isFinite(a) ? a : 0.1]
  }
}
