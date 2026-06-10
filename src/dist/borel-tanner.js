import { logGamma } from '../special'
import PreComputed from './_pre-computed'
import Distribution from './_distribution'

/**
 * Probability mass function for the [Borel-Tanner distribution]{@link https://en.wikipedia.org/wiki/Borel_distribution#Borel%E2%80%93Tanner_distribution}:
 *
 * $f(k; \mu, n) = \frac{n}{k}\frac{e^{-\mu k} (\mu k)^{k - n}}{(k - n)!},$
 *
 * where $\mu \in \[0, 1\]$ and $n \in \mathbb{N}^+$. Support: $k \ge n$.
 *
 * @class BorelTanner
 * @memberof ran.dist
 * @constructor
 */
export default class BorelTanner extends PreComputed {
  /**
   * @param {number} mu Distribution parameter.
   * @param {number} n Number of Borel distributed variates to add. If not an integer, it is rounded to the nearest one.
   */
  constructor (mu, n) {
    super()
    this.k = 2

    // Validate parameters
    const ni = Math.round(n)
    this.p = { mu, n: ni }
    Distribution.validate({ mu, n: ni }, [
      'mu >= 0', 'mu <= 1',
      'n > 0'
    ])

    // Set support
    this.s = [{
      value: ni,
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
    // Support starts at n; E[X] = n/(1-mu). Use min(data) for n and solve for mu.
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    const n = Math.max(1, data.reduce((m, x) => x < m ? x : m, data[0]))
    const mu = mean > n ? 1 - n / mean : 0
    return [Math.max(0, Math.min(0.99, mu)), n]
  }

  _pk (k) {
    if (k < this.p.n) {
      return 0
    }

    // mu = 0 case
    if (this.p.mu < Number.EPSILON) {
      return k === this.p.n ? 1 : 0
    }

    const kn = k - this.p.n
    return (this.p.n / k) * Math.exp(kn * Math.log(this.p.mu * k) - this.p.mu * k - logGamma(kn + 1))
  }
}
