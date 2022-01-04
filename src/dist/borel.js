import { logGamma } from '../special'
import PreComputed from './_pre-computed'
import Distribution from './_distribution'

/**
 * Generator for the [Borel distribution]{@link https://en.wikipedia.org/wiki/Borel_distribution}:
 *
 * $$f(k; \mu) = \frac{e^{-\mu k} (\mu k)^{k - 1}}{k!},$$
 *
 * where $\mu \in \[0, 1\]$. Support: $k \in \mathbb{N}^+$.
 *
 * @class Borel
 * @memberof ran.dist
 * @param {number} mu Distribution parameter. Default value is 0.5.
 * @constructor
 */
export default class extends PreComputed {
  constructor (mu = 0.5) {
    super(true)

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
