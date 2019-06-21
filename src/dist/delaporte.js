import logGamma from '../special/log-gamma'
import { gamma, poisson } from './_core'
import Distribution from './_distribution'
import PreComputed from './_pre-computed'

/**
 * Generator for the [Delaporte distribution]{@link }:
 *
 * $$f(k; \alpha, \beta, \lambda) = \frac{e^{-\lambda}}{\Gamma(\alpha)}\sum_{j = 0}^k \frac{\Gamma(\alpha + j) \beta^j \lambda^{k - j}}{j! (1 + \beta)^{\alpha + j} (k - j)!},$$
 *
 * with \(\alpha, \beta, \lambda > 0\). Support: \(k \in \mathbb{N}_0\). For \(\lambda = 0\), it is the [negative binomial]{@link #dist.NegativeBinomial}, and for \(\alpha = \beta = 0\) it is the [Poisson distribution]{@link #dist.Poisson}. Note that these special cases are not covered by this class. For these distributions, please refer to the corresponding generators.
 *
 * @class Delaporte
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter of the gamma component. Default component is 1.
 * @param {number=} beta Scale parameter of the gamma component. Default value is 1.
 * @param {number=} lambda Mean of the Poisson component. Default value is 1.
 * @constructor
 */
export default class extends PreComputed {
  constructor (alpha = 1, beta = 1, lambda = 1) {
    // Using raw probability mass values
    super()

    // Validate parameters
    this.p = { alpha, beta, lambda }
    Distribution._validate({ alpha, beta, lambda }, [
      'alpha > 0',
      'beta > 0',
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
      beta / (lambda * (1 + beta)),
      Math.exp(-lambda) / Math.pow(1 + beta, alpha)
    ]
  }

  _pk (k) {
    // Set i = 0 term
    let ki = k
    let dz = 1
    let z = dz

    // Advance until k - 1
    for (let j = 1; j < k; j++) {
      dz *= (this.p.alpha + j - 1) * this.c[0] * ki / j
      ki--
      z += dz
    }

    // If k > 0, add last term
    if (k > 0) {
      dz *= (this.p.alpha + k - 1) * this.c[0] / k
      z += dz
    }

    // Return sum with constants
    return z * Math.exp(k * Math.log(this.p.lambda) - logGamma(k + 1)) * this.c[1]
  }

  _generator () {
    // Direct sampling as compound Poisson
    let j = gamma(this.r, this.p.alpha, 1 / this.p.beta)
    return poisson(this.r, this.p.lambda + j)
  }
}
