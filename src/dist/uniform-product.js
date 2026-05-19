import Distribution from './_distribution'
import neumaier from '../algorithms/neumaier'
import { gamma, gammaUpperIncomplete } from '../special'

/**
 * Generator for the [product of uniform distribution]{@link https://mathworld.wolfram.com/UniformProductDistribution.html}:
 *
 * $$f(x; n) = \frac{(-\ln x)^{n-1}}{(n-1)!},$$
 *
 * with $n \in \mathbb{N}, n > 1$. Support: $x \in (0, 1\]$.
 *
 * @class UniformProduct
 * @memberof ran.dist
 * @param {number=} n Number of uniform factors. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @see https://mathworld.wolfram.com/UniformProductDistribution.html
 * @constructor
 */
export default class extends Distribution {
  constructor (n) {
    super('continuous', arguments.length)

    // Validate parameters
    const ni = Math.round(n)
    this.p = { n: ni }
    Distribution.validate({ n: ni }, [
      'n > 1'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: true
    }]
  }

  _generator () {
    return Math.exp(neumaier(Array.from({ length: this.p.n }, () => Math.log(this.r.next()))))
  }

  _pdf (x) {
    return Math.pow(-Math.log(x), this.p.n - 1) / gamma(this.p.n)
  }

  _cdf (x) {
    return gammaUpperIncomplete(this.p.n, -Math.log(x))
  }
}
