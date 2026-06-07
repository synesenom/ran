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
      normFactor: 2 * Math.pow(m, m) / Math.pow(omega, m),
      lGm: logGamma(m),
      lGm05: logGamma(m + 0.5),
      lGm15: logGamma(m + 1.5),
      sqrtRatio: Math.sqrt(omega / m)
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
    return this.c.normFactor * Math.pow(x, 2 * this.p.m - 1) * Math.exp(-this.p.m * x * x / this.p.omega - this.c.lGm)
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.m, this.p.m * x * x / this.p.omega)
  }

  /**
   * @returns {number} sqrt(omega/m)*Gamma(m+1/2)/Gamma(m).
   */
  mean () {
    return this.c.sqrtRatio * Math.exp(this.c.lGm05 - this.c.lGm)
  }

  /**
   * @returns {number} omega minus the squared mean.
   */
  variance () {
    const m1 = this.c.sqrtRatio * Math.exp(this.c.lGm05 - this.c.lGm)
    return this.p.omega - m1 * m1
  }

  /**
   * @returns {number} Standardised third central moment from raw moments.
   */
  skewness () {
    const { sqrtRatio, lGm, lGm05, lGm15 } = this.c
    const m1 = sqrtRatio * Math.exp(lGm05 - lGm)
    const m2 = this.p.omega
    const m3 = sqrtRatio ** 3 * Math.exp(lGm15 - lGm)
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 ** 3) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis from the first four raw moments.
   */
  kurtosis () {
    const { m, omega } = this.p
    const { sqrtRatio, lGm, lGm05, lGm15 } = this.c
    const m1 = sqrtRatio * Math.exp(lGm05 - lGm)
    const m2 = omega
    const m3 = sqrtRatio ** 3 * Math.exp(lGm15 - lGm)
    const m4 = (omega / m) ** 2 * m * (m + 1)
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 ** 4) / (v * v) - 3
  }
}
