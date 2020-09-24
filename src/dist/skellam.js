import { besselI } from '../special/bessel'
import marcumQ from '../special/marcum-q'
import { poisson } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [Skellam distribution]{@link https://en.wikipedia.org/wiki/Skellam_distribution}:
 *
 * $$f(k; \mu_1, \mu_2) = e^{-(\mu_1 + \mu_2)}\Big(\frac{\mu_1}{\mu_2}\Big)^{k/2} I_k(2 \sqrt{\mu_1 \mu_2}),$$
 *
 * with \(\mu_1, \mu_2 \ge 0\) and \(I_n(x)\) is the modified Bessel function of the first kind with order \(n\). Support: \(k \in \mathbb{N}\).
 *
 * @class Skellam
 * @memberof ran.dist
 * @param {number=} mu1 Mean of the first Poisson distribution. Default value is 1.
 * @param {number=} mu2 Mean of the second Poisson distribution. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu1 = 1, mu2 = 1) {
    super('discrete', arguments.length)

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
    this.c = [
      Math.exp(-mu1 - mu2),
      Math.sqrt(mu1 / mu2),
      2 * Math.sqrt(mu1 * mu2),
      marcumQ(1, mu2, mu1)
    ]
  }

  _generator () {
    // Direct sampling
    return poisson(this.r, this.p.mu1) - poisson(this.r, this.p.mu2)
  }

  _pdf (x) {
    return this.c[0] * Math.pow(this.c[1], x) * besselI(Math.abs(x), this.c[2])
  }

  _cdf (x) {
    if (x <= -1) {
      return 1 - marcumQ(-x, this.p.mu1, this.p.mu2)
    }
    if (x >= 1) {
      return marcumQ(x + 1, this.p.mu2, this.p.mu1)
    }
    return this.c[3]
  }

  _q (p) {
    return Math.floor(this._qEstimateRoot(p))
  }
}
