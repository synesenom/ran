import { logGamma } from '../special'
import PreComputed from './_pre-computed'
import Distribution from './_distribution'

/**
 * Probability mass function for the [Borel distribution]{@link https://en.wikipedia.org/wiki/Borel_distribution}:
 *
 * $f(k; \mu) = \frac{e^{-\mu k} (\mu k)^{k - 1}}{k!},$
 *
 * where $\mu \in \[0, 1\]$. Support: $k \in \mathbb{N}^+$.
 *
 * @class Borel
 * @memberof ran.dist
 * @constructor
 */
export default class Borel extends PreComputed {
  /**
   * @param {number} mu Distribution parameter.
   */
  constructor (mu) {
    super(true)
    this.k = 1

    // Validate parameters
    this.p = { mu }
    Distribution.validate({ mu }, [
      'mu >= 0', 'mu <= 1'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // E[X] = 1/(1-mu); solving gives mu = 1 - 1/mean.
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [Math.max(0, Math.min(0.99, mean > 1 ? 1 - 1 / mean : 0))]
  }

  _pk (k) {
    if (k < 1) {
      return -Infinity
    }

    // mu = 0 case
    if (this.p.mu < Number.EPSILON) {
      return k === 1 ? 0 : -Infinity
    }

    return (k - 1) * Math.log(this.p.mu * k) - this.p.mu * k - logGamma(k + 1)
  }
}
