import Distribution from './_distribution'
import { polylogarithm } from '../special'

/**
 * Probability density function for the [exponential-logarithmic distribution]{@link https://en.wikipedia.org/wiki/Exponential-logarithmic_distribution#Related_distribution}:
 *
 * $f(x; p, \beta) = -\frac{1}{\ln p} \frac{\beta (1 - p) e^{-\beta x}}{1 - (1 - p) e^{-\beta x}},$
 *
 * with $p \in (0, 1)$ and $\beta > 0$. Support: $x \ge 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; p, \beta) = 1 - \frac{\ln\left(1 - (1 - p)\,e^{-\beta x}\right)}{\ln p}$
 *
 * @class ExponentialLogarithmic
 * @memberof ran.dist
 * @constructor
 */
export default class ExponentialLogarithmic extends Distribution {
  /**
   * @param {number} p Shape parameter.
   * @param {number} beta Scale parameter.
   */
  constructor (p, beta) {
    super('continuous', 2)

    // Validate parameters
    this.p = { p, beta }
    Distribution.validate({ p, beta }, [
      'p > 0', 'p < 1',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Pre-compute polylogarithm values Li_2..Li_5 at z=1-p (fixed for given p)
    const z = 1 - p
    const lnp = Math.log(p)
    this.c = {
      z,
      lnp,
      li2: polylogarithm(2, z),
      li3: polylogarithm(3, z),
      li4: polylogarithm(4, z),
      li5: polylogarithm(5, z)
    }
  }

  static _fitInit (data) {
    // beta ≈ 1/mean (exponential rate MLE); p = 0.5 as neutral shape seed for Nelder-Mead.
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    return [0.5, Math.max(0.01, 1 / mean)]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = (1 - this.p.p) * Math.exp(-this.p.beta * x)
    return this.p.beta * y / ((y - 1) * this.c.lnp)
  }

  _cdf (x) {
    return 1 - Math.log(1 - (1 - this.p.p) * Math.exp(-this.p.beta * x)) / this.c.lnp
  }

  _q (p) {
    return (Math.log(1 - this.p.p) - Math.log(1 - Math.pow(this.p.p, 1 - p))) / this.p.beta
  }

  /**
   * @returns {number} -Li_2(1-p) / (beta * ln(p)).
   */
  mean () {
    return -this.c.li2 / (this.p.beta * this.c.lnp)
  }

  /**
   * @returns {number} Second central moment via raw moments up to order 2.
   */
  variance () {
    const b = this.p.beta
    const m1 = -this.c.li2 / (b * this.c.lnp)
    const m2 = -2 * this.c.li3 / (b * b * this.c.lnp)
    return m2 - m1 * m1
  }

  /**
   * @returns {number} Standardised third central moment via raw moments up to order 3.
   */
  skewness () {
    const b = this.p.beta
    const m1 = -this.c.li2 / (b * this.c.lnp)
    const m2 = -2 * this.c.li3 / (b * b * this.c.lnp)
    const m3 = -6 * this.c.li4 / (b * b * b * this.c.lnp)
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 * m1 * m1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis via raw moments up to order 4.
   */
  kurtosis () {
    const b = this.p.beta
    const m1 = -this.c.li2 / (b * this.c.lnp)
    const m2 = -2 * this.c.li3 / (b * b * this.c.lnp)
    const m3 = -6 * this.c.li4 / (b * b * b * this.c.lnp)
    const m4 = -24 * this.c.li5 / (b * b * b * b * this.c.lnp)
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 * m1 * m1 * m1) / (v * v) - 3
  }
}
