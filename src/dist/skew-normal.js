import clamp from '../utils/clamp'
import { erf, owenT } from '../special'
import Normal from './normal'

/**
 * Probability density function for the [skew normal distribution]{@link https://en.wikipedia.org/wiki/Skew_normal_distribution}:
 *
 * $f(x; \xi, \omega, \alpha) = \frac{2}{\omega} \phi\bigg(\frac{x - \xi}{\omega}\bigg) \Phi\bigg(\alpha \frac{x - \xi}{\omega}\bigg),$
 *
 * where $\xi, \alpha \in \mathbb{R}$, $\omega > 0$ and $\phi(x)$, $\Phi(x)$ denote the probability density and
 * cumulative distribution functions of the standard [normal distribution]{@link #dist.Normal}.
 * Support: $x \in \mathbb{R}$.
 *
 * @class SkewNormal
 * @memberof ran.dist
 * @constructor
 */
export default class SkewNormal extends Normal {
  /**
   * @param {number} xi Location parameter.
   * @param {number} omega Scale parameter.
   * @param {number} alpha Shape parameter.
   */
  constructor (xi, omega, alpha) {
    super(xi, omega)

    // SkewNormal has 3 free parameters (xi, omega, alpha); override the 2 inherited from Normal
    // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
    this.k = 3

    // Add new parameter
    this.p = Object.assign(this.p, { xi, omega, alpha })

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants (be aware of the constants for the parent)
    const delta = this.p.alpha / Math.sqrt(1 + this.p.alpha * this.p.alpha)
    Object.assign(this.c, {
      delta,
      deltaComplement: Math.sqrt(1 - delta * delta)
    })
  }

  _generator () {
    // Azzalini's method (http://azzalini.stat.unipd.it/SN/faq-r.html) needs two independent
    // standard normals; Box-Muller naturally produces both branches from one uniform pair,
    // halving PRNG consumption vs. calling _normal twice and discarding one branch each time.
    // See solutions/distribution/2026-05-16-1920-skewnormal-box-muller-branch-waste.md
    const bmu = this.r.next()
    const bmv = this.r.next()
    const mag = Math.sqrt(-2 * Math.log(bmu))
    const u0 = mag * Math.sin(2 * Math.PI * bmv)
    const v = mag * Math.cos(2 * Math.PI * bmv)
    const u1 = this.c.delta * u0 + this.c.deltaComplement * v
    const z = u0 >= 0 ? u1 : -u1
    return this.p.xi + this.p.omega * z
  }

  _pdf (x) {
    return super._pdf(x) * (1 + erf(this.p.alpha * Math.SQRT1_2 * (x - this.p.xi) / this.p.omega))
  }

  _cdf (x) {
    const z = super._cdf(x) - 2 * owenT((x - this.p.xi) / this.p.omega, this.p.alpha)
    return clamp(z)
  }

  _q (p) {
    return this._qEstimateRoot(p)
  }

  /**
   * @returns {number} Mean of the distribution.
   */
  mean () {
    return this.p.xi + this.p.omega * this.c.delta * Math.sqrt(2 / Math.PI)
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    return this.p.omega ** 2 * (1 - 2 * this.c.delta ** 2 / Math.PI)
  }

  /**
   * @returns {number} Skewness of the distribution.
   */
  skewness () {
    const dz = this.c.delta * Math.sqrt(2 / Math.PI)
    const v = 1 - dz * dz
    return (4 - Math.PI) / 2 * dz ** 3 / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis of the distribution.
   */
  kurtosis () {
    const dz = this.c.delta * Math.sqrt(2 / Math.PI)
    const v = 1 - dz * dz
    return 2 * (Math.PI - 3) * dz ** 4 / (v * v)
  }

  static _fitInit (data) {
    const n = data.length
    const xi = data.reduce((s, x) => s + x, 0) / n
    const omega = Math.sqrt(data.reduce((s, x) => s + (x - xi) ** 2, 0) / n) || 1
    // alpha=0 is the symmetric saddle: the likelihood is even in alpha there, so a coordinate
    // optimizer (Powell) cannot leave it. Seed alpha with the sign and rough scale of the sample
    // skewness to break the symmetry; the magnitude need only be off the saddle, not accurate.
    const g1 = data.reduce((s, x) => s + ((x - xi) / omega) ** 3, 0) / n
    const alpha = clamp(Math.sign(g1) * Math.min(Math.abs(g1) * 4, 4), -4, 4)
    return [xi, omega, alpha]
  }
}
