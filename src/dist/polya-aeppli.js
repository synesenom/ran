import Distribution from './_distribution'
import PreComputed from './_pre-computed'
import { poisson } from './_core'

/**
 * Generator for the [Pólya-Aeppli distribution]{@link https://arxiv.org/abs/1406.2780} (also known as [geometric Poisson distribution]{@link https://en.wikipedia.org/wiki/Geometric_Poisson_distribution}):
 *
 * $$f(k; \lambda, \theta) = \begin{cases}e^{-\lambda} &\quad\text{if $k = 0$},\\e^{-\lambda} \sum_{j = 1}^k \frac{\lambda^j}{j!} \begin{pmatrix}k - 1 \\ j - 1 \\ \end{pmatrix} \theta^{k - j} (1 - \theta)^j &\quad\text{otherwise}\\\end{cases},$$
 *
 * where \(\lambda > 0\) and \(\theta \in (0, 1)\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class PolyaAeppli
 * @memberOf ran.dist
 * @param {number=} lambda Mean of the Poisson component. Default value is 1.
 * @param {number=} theta Parameter of the shifted geometric component. Default value is 0.5.
 * @constructor
 */
export default class extends PreComputed {
  constructor (lambda = 1, theta = 0.5) {
    // Using logarithmic probability mass values
    super(true)

    // Validate parameters
    this.p = { lambda, theta }
    Distribution.validate({ lambda, theta }, [
      'lambda > 0',
      'theta > 0', 'theta < 1'
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
      Math.log(lambda * (1 - theta)) - lambda
    ]
  }

  _pk (k) {
    if (k === 0) {
      return -this.p.lambda
    }

    if (k === 1) {
      return this.c[0]
    }

    return this.pdfTable[k - 1] + Math.log((this.p.lambda * (1 - this.p.theta) + 2 * (k - 1) * this.p.theta - this.p.theta * this.p.theta * (k - 2) * Math.exp(this.pdfTable[k - 2] - this.pdfTable[k - 1])) / k)
  }

  _generator () {
    const N = poisson(this.r, this.p.lambda)
    let z = 0
    for (let i = 0; i < N; i++) {
      z += Math.floor(Math.log(this.r.next()) / Math.log(this.p.theta)) + 1
    }
    return Math.round(z)
  }
}
