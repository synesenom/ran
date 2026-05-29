import { gammaLowerIncomplete, logGamma } from '../special'
import gamma from './_gamma'
import Distribution from './_distribution'

/**
 * Probability density function for the [Nakagami distribution]{@link https://en.wikipedia.org/wiki/Nakagami_distribution}:
 *
 * $f(x; m, \Omega) = \frac{2m^m}{\Gamma(m) \Omega^m} x^{2m - 1} e^{-\frac{m}{\Omega} x^2},$
 *
 * where $m \in \mathbb{R}$, $m \ge 0.5$ and $\Omega > 0$. Support: $x > 0$.
 *
 * @class Nakagami
 * @memberof ran.dist
 * @constructor
 */
export default class Nakagami extends Distribution {
  /**
   * @param {number} m Shape parameter.
   * @param {number} omega Spread parameter.
   */
  constructor (m, omega) {
    super('continuous', 2)

    // Validate parameters
    this.p = { m, omega }
    Distribution.validate({ m, omega }, [
      'm >= 0.5',
      'omega > 0'
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
      normFactor: 2 * Math.pow(this.p.m, this.p.m) / Math.pow(this.p.omega, this.p.m)
    }
  }

  static _fitInit (data) {
    // MOM on X²~Gamma(m, omega/m): E[X²]=omega, Var[X²]=omega²/m ⇒ m=E[X²]²/Var[X²], clamped ≥0.5
    const n = data.length
    const mean2 = data.reduce((s, x) => s + x * x, 0) / n
    const var2 = data.reduce((s, x) => s + (x * x - mean2) ** 2, 0) / n || mean2 * mean2
    return [Math.max(mean2 * mean2 / var2, 0.5), mean2]
  }

  _generator () {
    // Direct sampling from gamma
    return Math.sqrt(gamma(this.r, this.p.m, this.p.m / this.p.omega))
  }

  _pdf (x) {
    return this.c.normFactor * Math.pow(x, 2 * this.p.m - 1) * Math.exp(-this.p.m * x * x / this.p.omega - logGamma(this.p.m))
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.m, this.p.m * x * x / this.p.omega)
  }
}
