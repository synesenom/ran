import { besselI, besselISpherical } from '../special/bessel'
import marcumQ from '../special/marcum-q'
import { noncentralChi2 } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [non-central \(\chi^2\) distribution]{@link https://en.wikipedia.org/wiki/Noncentral_chi-squared_distribution}:
 *
 * $$f(x; k; \lambda) = \frac{1}{2}e^{-\frac{x + \lambda}{2}} \bigg(\frac{x}{\lambda}\bigg)^{k/4 - 1/2} I_{k/2 - 1}\big(\sqrt{\lambda x}\big),$$
 *
 * with \(k \in \mathbb{N}^+\), \(\lambda > 0\) and \(I_n(x)\) is the modified Bessel function of the first kind with order \(n\). Support: \(x \in [0, \infty)\).
 *
 * @class NoncentralChi2
 * @memberOf ran.dist
 * @param {number=} k Degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (k = 2, lambda = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    let ki = Math.round(k)
    this.p = { k: ki, lambda }
    Distribution._validate({ k: ki, lambda }, [
      'k > 0',
      'lambda > 0'
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
      this.p.k % 2 === 0
    ]
  }

  _generator () {
    // Direct sampling
    return noncentralChi2(this.r, this.p.k, this.p.lambda)
  }

  _pdf (x) {
    if (this.c[0]) {
      // k is even
      if (this.p.k === 2 && x === 0) {
        // k = 2, x -> 0, by differentiating F(x)
        return 0.5 * Math.exp(-0.5 * this.p.lambda)
      } else {
        return 0.5 * Math.exp(-0.5 * (x + this.p.lambda)) * Math.pow(x / this.p.lambda, this.p.k / 4 - 0.5) * besselI(Math.abs(Math.floor(this.p.k / 2) - 1), Math.sqrt(this.p.lambda * x))
      }
    } else {
      // k is odd
      if (this.p.k === 1 && x === 0) {
        // k = 1, x -> 0, by differentiating F(x)
        return 0.5 * Math.exp(-0.5 * this.p.lambda) * Math.sqrt(2 / Math.PI)
      } else {
        return 0.5 * Math.exp(-0.5 * (x + this.p.lambda)) * Math.pow(x / this.p.lambda, this.p.k / 4 - 0.5) * besselISpherical(Math.floor((this.p.k - 3) / 2), Math.sqrt(this.p.lambda * x)) * Math.sqrt(2 * Math.sqrt(x * this.p.lambda) / Math.PI)
      }
    }
  }

  _cdf (x) {
    return 1 - marcumQ(this.p.k / 2, this.p.lambda / 2, x / 2)
  }
}
