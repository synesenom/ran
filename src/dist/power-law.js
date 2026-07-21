import Kumaraswamy from './kumaraswamy'

/**
 * Probability density function for the [power-law distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.powerlaw.html} (also called power-law distribution):
 *
 * $f(x; a) = a x^{a - 1},$
 *
 * with $a > 0$. Support: $x \in (0, 1)$.
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

    // PowerLaw has 1 free parameter (a); override the 2 inherited from Kumaraswamy
    // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
    this.k = 1
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { a } = this.p
    return a / (a + 1)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { a } = this.p
    return a / ((a + 2) * (a + 1) * (a + 1))
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { a } = this.p
    const m1 = a / (a + 1)
    const m2 = a / (a + 2)
    const m3 = a / (a + 3)
    const mu2 = m2 - m1 * m1
    const mu3 = m3 - 3 * m2 * m1 + 2 * m1 * m1 * m1
    return mu3 / Math.pow(mu2, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { a } = this.p
    const m1 = a / (a + 1)
    const m2 = a / (a + 2)
    const m3 = a / (a + 3)
    const m4 = a / (a + 4)
    const mu2 = m2 - m1 * m1
    const mu4 = m4 - 4 * m3 * m1 + 6 * m2 * m1 * m1 - 3 * m1 * m1 * m1 * m1
    return mu4 / (mu2 * mu2) - 3
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // f(x)=a·x^{a−1} on (0,1) → E[log X] = −1/a; the exact MLE is a = −1/mean(log x). For in-support
    // data every log(x) < 0 so mean(log x) < 0 and a > 0 always; guard only the degenerate empty case.
    // The MLE is biased in finite samples (cf. Pareto exponent, Newman 2006); fit() returns the MLE by design.
    const n = data.length
    const logMean = data.reduce((s, x) => s + Math.log(x), 0) / n
    const a = -1 / logMean
    return [a > 0 && Number.isFinite(a) ? a : 0.1]
  }
}
