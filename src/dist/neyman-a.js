import poisson from './_poisson'
import Distribution from './_distribution'
import PreComputed from './_pre-computed'

/**
 * Probability mass function for the [Neyman type A distribution]{@link http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.527.574&rep=rep1&type=pdf}:
 *
 *$f(k; \lambda, \phi) = \frac{e^{-\lambda + \lambda e^{-\phi}} \phi^k}{k!} \sum_{j=1}^k S(k, j) \lambda^k e^{-\phi k},$
 *
 * where $\lambda, \theta > 0$ and $S(n, m)$ denotes the [Stirling number of the second kind]{@link https://en.wikipedia.org/wiki/Stirling_numbers_of_the_second_kind}. Support: $k \in \mathbb{N}_0$.
 *
 * @class NeymanA
 * @memberof ran.dist
 * @constructor
 */
export default class NeymanA extends PreComputed {
  /**
   * @param {number} lambda Mean of the number of clusters.
   * @param {number} phi Mean of the cluster size.
   */
  constructor (lambda, phi) {
    // Using raw probability mass values
    super()
    this.k = 2

    // Validate parameters
    this.p = { lambda, phi }
    Distribution.validate({ lambda, phi }, [
      'lambda > 0',
      'phi > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      p0: Math.exp(-lambda * (1 - Math.exp(-phi))),
      r: lambda * phi * Math.exp(-phi)
    }
  }

  static _fitInit (data) {
    // E[X] = lambda*phi, Var[X] = lambda*phi*(1+phi); solving gives phi = V/E - 1.
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    const variance = data.reduce((s, x) => s + x * x, 0) / data.length - mean * mean
    const phi = Math.max(0.01, variance / mean - 1)
    return [Math.max(0.01, mean / phi), phi]
  }

  // Using Eq. (131) in Johnson, Kotz, Kemp: Univariate Discrete Distributions.
  _pk (k) {
    if (k === 0) {
      return this.c.p0
    }

    let dz = 1
    let z = this.pdfTable[k - 1]
    for (let j = 1; j < k; j++) {
      dz *= this.p.phi / j
      z += dz * this.pdfTable[k - j - 1]
    }
    return this.c.r * z / k
  }

  _generator () {
    const N = poisson(this.r, this.p.lambda)
    let z = 0
    for (let i = 0; i < N; i++) {
      z += poisson(this.r, this.p.phi)
    }
    return Math.round(z)
  }
}
