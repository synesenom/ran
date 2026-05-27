import { besselI, marcumQ } from '../special'
import poisson from './_poisson'
import Distribution from './_distribution'

/**
 * Probability function for the [Skellam distribution]{@link https://en.wikipedia.org/wiki/Skellam_distribution}:
 *
 * $f(k; \mu_1, \mu_2) = e^{-(\mu_1 + \mu_2)}\Big(\frac{\mu_1}{\mu_2}\Big)^{k/2} I_k(2 \sqrt{\mu_1 \mu_2}),$
 *
 * with $\mu_1, \mu_2 \ge 0$ and $I_n(x)$ is the modified Bessel function of the first kind with order $n$. Support: $k \in \mathbb{N}$.
 *
 * @class Skellam
 * @memberof ran.dist
 * @constructor
 */
export default class Skellam extends Distribution {
  /**
   * @param {number} mu1 Mean of the first Poisson distribution.
   * @param {number} mu2 Mean of the second Poisson distribution.
   */
  constructor (mu1, mu2) {
    super('discrete', 2)

    // Validate parameters
    this.p = { mu1, mu2 }
    Distribution.validate({ mu1, mu2 }, [
      'mu1 > 0',
      'mu2 > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      expNeg: Math.exp(-mu1 - mu2),
      sqrtRatio: Math.sqrt(mu1 / mu2),
      twoSqrtProd: 2 * Math.sqrt(mu1 * mu2),
      cdfAtZero: marcumQ(1, mu2, mu1)
    }
  }

  _generator () {
    // Direct sampling
    return poisson(this.r, this.p.mu1) - poisson(this.r, this.p.mu2)
  }

  _pdf (x) {
    return this.c.expNeg * Math.pow(this.c.sqrtRatio, x) * besselI(Math.abs(x), this.c.twoSqrtProd)
  }

  _cdf (x) {
    if (x <= -1) {
      return 1 - marcumQ(-x, this.p.mu1, this.p.mu2)
    }
    if (x >= 1) {
      return marcumQ(x + 1, this.p.mu2, this.p.mu1)
    }
    return this.c.cdfAtZero
  }

  _q (p) {
    return this._qEstimateWalk(p, Math.floor(this.p.mu1 - this.p.mu2))
  }
}
