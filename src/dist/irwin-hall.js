import neumaier from '../algorithms/neumaier'
import logGamma from '../special/log-gamma'
import Distribution from './_distribution'

/**
 * Generator for the [Irwin-Hall distribution]{@link https://en.wikipedia.org/wiki/Irwin%E2%80%93Hall_distribution}:
 *
 * $$f(x; n) = \frac{1}{(n - 1)!} \sum_{k = 0}^{\lfloor x\rfloor} (-1)^k \begin{pmatrix}n \\ k \\ \end{pmatrix} (x - k)^{n - 1},$$
 *
 * with \(n \in \mathbb{N}^+\). Support: \(x \in [0, n]\).
 *
 * @class IrwinHall
 * @memberOf ran.dist
 * @param {number=} n Number of uniform variates to sum. If not an integer, it is rounded to the nearest one. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (n = 1) {
    super('continuous', arguments.length)

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

    // Speed-up constants
    this.c = Array.from({ length: ni + 1 }, (d, k) => logGamma(k + 1) + logGamma(ni - k + 1))
  }

  _generator () {
    // Direct sampling
    return neumaier(Array.from({ length: this.p.n }, () => this.r.next()))
  }

  _pdf (x) {
    // Use symmetry property for large x values
    const y = x < this.p.n / 2 ? x : this.p.n - x

    // Compute terms
    const terms = Array.from({ length: Math.floor(y) + 1 }, (d, k) => {
      const z = (this.p.n - 1) * Math.log(y - k) - this.c[k]

      return k % 2 === 0 ? Math.exp(z) : -Math.exp(z)
    })

    // Sort terms
    terms.sort((a, b) => Math.abs(a) - Math.abs(b))

    // Calculate sum
    return this.p.n * neumaier(terms)
  }

  _cdf (x) {
    // Use symmetry property for large x values
    const y = x < this.p.n / 2 ? x : this.p.n - x

    // Compute terms
    const terms = Array.from({ length: Math.floor(y) + 1 }, (d, k) => {
      const z = this.p.n * Math.log(y - k) - this.c[k]

      return k % 2 === 0 ? Math.exp(z) : -Math.exp(z)
    })

    // Sort terms
    terms.sort((a, b) => Math.abs(a) - Math.abs(b))

    // Calculate sum
    return x < this.p.n / 2 ? neumaier(terms) : 1 - neumaier(terms)
  }
}
