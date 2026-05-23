import { besselI, besselISpherical, marcumP, logGamma } from '../special'
import noncentralChi2 from './_noncentral-chi2'
import Distribution from './_distribution'

/**
 * Generator for the [non-central $\chi^2$ distribution]{@link https://en.wikipedia.org/wiki/Noncentral_chi-squared_distribution}:
 *
 * $$f(x; k; \lambda) = \frac{1}{2}e^{-\frac{x + \lambda}{2}} \bigg(\frac{x}{\lambda}\bigg)^{k/4 - 1/2} I_{k/2 - 1}\big(\sqrt{\lambda x}\big),$$
 *
 * with $k \in \mathbb{N}^+$, $\lambda \ge 0$ and $I_n(x)$ is the modified Bessel function of the first kind with order $n$. Support: $x \in [0, \infty)$. When $\lambda = 0$ the distribution degenerates to a central $\chi^2(k)$.
 *
 * @class NoncentralChi2
 * @memberof ran.dist
 * @param {number} k Degrees of freedom. If not an integer, it is rounded to the nearest one.
 * @param {number} lambda Non-centrality parameter.
 * @see https://en.wikipedia.org/wiki/Noncentral_chi-squared_distribution
 * @constructor
 */
export default class extends Distribution {
  constructor (k, lambda) {
    super('continuous', 2)

    // Validate parameters
    const ki = Math.round(k)
    this.p = { k: ki, lambda }
    Distribution.validate({ k: ki, lambda }, [
      'k > 0',
      'lambda >= 0'
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
      kIsEven: this.p.k % 2 === 0
    }
  }

  _generator () {
    // Direct sampling
    return noncentralChi2(this.r, this.p.k, this.p.lambda)
  }

  _pdf (x) {
    if (this.p.lambda === 0) {
      // Bessel form divides by λ and is undefined at zero; fall back to central chi-squared density
      if (this.p.k === 2 && x === 0) {
        // 0*log(0) = NaN without the guard; limit is 0.5
        return 0.5
      }
      return Math.exp(
        (this.p.k / 2 - 1) * Math.log(x) - x / 2 -
        (this.p.k / 2) * Math.LN2 - logGamma(this.p.k / 2)
      )
    }

    if (this.c.kIsEven) {
      // k is even
      if (this.p.k === 2 && x === 0) {
        // k = 2, x -> 0, by differentiating F(x)
        return 0.5 * Math.exp(-0.5 * this.p.lambda)
      } else {
        return 0.5 * Math.exp(-0.5 * (x + this.p.lambda) + (this.p.k / 4 - 0.5) * Math.log(x / this.p.lambda)) * besselI(Math.round(this.p.k / 2) - 1, Math.sqrt(this.p.lambda * x))
        // return 0.5 * Math.exp(-0.5 * (x + this.p.lambda)) * Math.pow(x / this.p.lambda, this.p.k / 4 - 0.5) * besselI(Math.abs(Math.floor(this.p.k / 2) - 1), Math.sqrt(this.p.lambda * x))
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
    // Complementary Marcum Q avoids catastrophic cancellation in the
    // lower tail: `1 - marcumQ(...)` would lose precision because
    // marcumQ internally forms `1 - P` to deliver Q (#245).
    // See solutions/special-functions/2026-05-18-1212-noncentral-chi2-cdf-complementary-marcum-q.md
    return marcumP(this.p.k / 2, this.p.lambda / 2, x / 2)
  }
}
