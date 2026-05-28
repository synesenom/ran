import neumaier from '../algorithms/neumaier'
import { logGamma } from '../special'
import Distribution from './_distribution'

/**
 * Probability density function for the [Irwin-Hall distribution]{@link https://en.wikipedia.org/wiki/Irwin%E2%80%93Hall_distribution}:
 *
 * $f(x; n) = \frac{1}{(n - 1)!} \sum_{k = 0}^{\lfloor x\rfloor} (-1)^k \begin{pmatrix}n \\\\ k \\\\ \end{pmatrix} (x - k)^{n - 1},$
 *
 * with $n \in \mathbb{N}^+$. Support: $x \in \[0, n\]$.
 *
 * @class IrwinHall
 * @memberof ran.dist
 * value is 1.
 * @constructor
 */
export default class IrwinHall extends Distribution {
  /**
   * @param {number} n Number of uniform variates to sum. If not an integer, it is rounded to the nearest one. Default
   */
  constructor (n) {
    super('continuous', 1)

    // Validate parameters
    const ni = Math.round(n)
    this.p = { n: ni }
    Distribution.validate({ n: ni }, [
      'n > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: ni,
      closed: true
    }]

    // Speed-up constants — logGammaTerms is a runtime-indexed lookup table, see decisions/0008-this-c-named-object-convention.md
    this.c = { logGammaTerms: Array.from({ length: ni + 1 }, (d, k) => logGamma(k + 1) + logGamma(ni - k + 1)) }
  }

  static _fitInit (data) {
    // Sum of n uniforms on [0,1]: E[X] = n/2 ⇒ n = round(2·mean)
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [Math.max(Math.round(2 * mean), 1)]
  }

  _generator () {
    // Direct sampling
    return neumaier(Array.from({ length: this.p.n }, () => this.r.next()))
  }

  _pdf (x) {
    // Use symmetry property for large x values
    const y = x < this.p.n / 2 ? x : this.p.n - x
    const { logGammaTerms } = this.c

    // Compute terms
    const terms = Array.from({ length: Math.floor(y) + 1 }, (d, k) => {
      const z = (this.p.n - 1) * Math.log(y - k) - logGammaTerms[k]

      return k % 2 === 0 ? Math.exp(z) : -Math.exp(z)
    })

    // Sort terms
    terms.sort((a, b) => a - b)

    // Calculate sum
    return this.p.n * neumaier(terms)
  }

  _cdf (x) {
    // Use symmetry property for large x values
    const y = x < this.p.n / 2 ? x : this.p.n - x
    const { logGammaTerms } = this.c

    // Compute terms
    const terms = Array.from({ length: Math.floor(y) + 1 }, (d, k) => {
      const z = this.p.n * Math.log(y - k) - logGammaTerms[k]

      return k % 2 === 0 ? Math.exp(z) : -Math.exp(z)
    })

    // Sort terms
    const sum = neumaier(terms.sort((a, b) => a - b))

    // Calculate sum
    return x < this.p.n / 2 ? sum : 1 - sum
  }
}
