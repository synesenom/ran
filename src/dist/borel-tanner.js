import logGamma from '../special/log-gamma'
import PreComputed from './_pre-computed'
import Distribution from './_distribution'

/**
 * Generator for the [Borel-Tanner distribution]{@link https://en.wikipedia.org/wiki/Borel_distribution#Borel%E2%80%93Tanner_distribution}:
 *
 * $$f(k; \mu, n) = \frac{n}{k}\frac{e^{-\mu k} (\mu k)^{k - n}}{(k - n)!},$$
 *
 * where $\mu \in \[0, 1\]$ and $n \in \mathbb{N}^+$. Support: $k \ge n$.
 *
 * @class BorelTanner
 * @memberof ran.dist
 * @param {number} mu Distribution parameter. Default value is 0.5.
 * @param {number} n Number of Borel distributed variates to add. If not an integer, it is rounded to the nearest one.
 * Default value is 2.
 * @constructor
 */
export default class extends PreComputed {
  constructor (mu = 0.5, n = 2) {
    super()

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
