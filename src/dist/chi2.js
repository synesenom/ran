import Distribution from './_distribution'
import Gamma from './gamma'

/**
 * Probability density function for the [$\chi^2$ distribution]{@link https://en.wikipedia.org/wiki/Chi-squared_distribution}:
 *
 * $f(x; k) = \frac{1}{2^{k/2} \Gamma(k/2)} x^{k/2 - 1} e^{-x/2},$
 *
 * where $k \in \mathbb{N}^+$. Support: $x > 0$.
 *
 * @class Chi2
 * @memberof ran.dist
 * @constructor
 */
export default class Chi2 extends Gamma {
  // Special case of gamma
  /**
   * @param {number} k Degrees of freedom. If not an integer, is rounded to the nearest one.
   */
  constructor (k) {
    super(Math.round(k) / 2, 0.5)

    // Chi2 has 1 free parameter (k); override the 2 inherited from Gamma
    this.k = 1

    // Validate parameters
    Distribution.validate({ k }, [
      'k > 0'
    ])
  }

  static _fitInit (data) {
    // E[X] = k, so the sample mean directly estimates the degrees of freedom
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [Math.max(1, Math.round(mean))]
  }

  /**
   * @param {number[]} data Array of sample values.
   * @returns {Chi2} Fitted distribution.
   */
  static fit (data) {
    const Cls = this
    const [kHat] = Cls._fitInit(data)
    const kSeed = Math.round(kHat)
    const w = Distribution._adaptiveHalfWidth(k => { try { return new Cls(k).lnL(data) } catch (_) { return -Infinity } }, kSeed, 1)
    const kLo = Math.max(1, kSeed - w)
    const kHi = kSeed + w
    let bestK = kSeed
    let bestLnL = -Infinity
    for (let k = kLo; k <= kHi; k++) {
      try {
        const lnL = new Cls(k).lnL(data)
        if (lnL > bestLnL) { bestLnL = lnL; bestK = k }
      } catch (_) {}
    }
    return new Cls(bestK)
  }
}
