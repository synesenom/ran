import recursiveSum from '../algorithms/recursive-sum'
import betaFn from '../special/beta'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import { chi2, noncentralChi2 } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [non-central beta distribution]{@link https://en.wikipedia.org/wiki/Noncentral_beta_distribution}:
 *
 * $$f(x; d_1, d_2, \lambda) = e^{-\frac{\lambda}{2}} \sum_{k=0}^\infty \frac{1}{k!} \bigg(\frac{\lambda}{2}\bigg)^k \frac{x^{\alpha + k - 1} (1 - x)^{\beta - 1}}{\mathrm{B}\Big(\alpha + k, \beta\Big)},$$
 *
 * where \(\alpha, \beta > 0\) and \(\lambda \ge 0\). Support: \(x \in [0, 1]\).
 *
 * @class NoncentralBeta
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (alpha = 1, beta = 1, lambda = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { alpha, beta, lambda }
    Distribution._validate({ alpha, beta, lambda }, [
      'alpha > 0',
      'beta > 0',
      'lambda >= 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]

    // Speed-up constants
    this.c = [
      Math.exp(-0.5 * lambda),
      betaFn(alpha, beta)
    ]
  }

  _generator () {
    // Direct sampling from non-central chi2 and chi2
    let x = noncentralChi2(this.r, 2 * this.p.alpha, this.p.lambda)
    let y = chi2(this.r, 2 * this.p.beta)
    let z = x / (x + y)

    // Handle 1 - z << 1 case
    if (z === 1) {
      return 1 - y / x
    } else {
      return z
    }
  }

  _pdf (x) {
    let xa = Math.pow(x, this.p.alpha - 1)
    let xb = Math.pow(1 - x, this.p.beta - 1)
    return this.c[0] * recursiveSum({
      c: xa * xb,
      a: this.p.alpha,
      bxy: this.c[1]
    }, (t, i) => {
      t.c *= 0.5 * this.p.lambda * x / i
      t.bxy *= t.a / (t.a + this.p.beta)
      t.a++
      return t
    }, t => t.c / t.bxy)
  }

  _cdf (x) {
    let xb = Math.pow(1 - x, this.p.beta)
    return this.c[0] * recursiveSum({
      c: 1,
      a: this.p.alpha,
      xa: Math.pow(x, this.p.alpha),
      bxy: this.c[1],
      ix: regularizedBetaIncomplete(this.p.alpha, this.p.beta, x)
    }, (t, i) => {
      t.c *= 0.5 * this.p.lambda / i
      t.ix -= t.xa * xb / (t.a * t.bxy)
      t.bxy *= t.a / (t.a + this.p.beta)
      t.a++
      t.xa *= x
      return t
    }, t => t.c * t.ix)
  }
}