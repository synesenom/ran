import { poisson } from './_core'
import Distribution from './_distribution'
import PreComputed from './_pre-computed'

/**
 * Generator for the [Neyman type A distribution]{@link http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.527.574&rep=rep1&type=pdf}:
 *
 *$$f(k; \lambda, \theta) = e^{-\lambda + \lambda e^{-\theta}},$$
 *
 * where \(\lambda, \theta > 0\). Support: \(k \in \mathbb{N}_0\0.
 *
 * @class NeymanA
 * @memberOf ran.dist
 * @param {number=} lambda Mean of the number of clusters. Default value is 1.
 * @param {number=} theta Mean of the cluster size. Default value is 1.
 * @constructor
 */
export default class extends PreComputed {
  constructor (lambda = 1, theta = 1) {
    // Using raw probability mass values
    super()

    // Validate parameters
    this.p = {lambda, theta}
    Distribution._validate({lambda, theta}, [
      'lambda > 0',
      'theta > 0'
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
    this.c = [
      Math.exp(-lambda * (1 - Math.exp(-theta))),
      lambda * theta * Math.exp(-theta)
    ]
  }

  // TODO Use Stirling numbers
  _pk(k) {
    if (k === 0) {
      return this.c[0]
    }

    let dz = 1
    let z = this.pdfTable[k - 1]
    for (let j = 1; j < k; j++) {
      dz *= this.p.theta / j
      z += dz * this.pdfTable[k - j - 1]
    }
    return this.c[1] * z / k
  }

  _generator () {
    let N = poisson(this.r, this.p.lambda)
    let z = 0
    for (let i = 0; i < N; i++) {
      z += poisson(this.r, this.p.theta)
    }
    return Math.round(z)
  }
}
