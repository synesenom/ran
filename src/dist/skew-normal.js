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
 * @see A. Azzalini, "SN package FAQ", https://azzalini.stat.unipd.it/SN/faq-r.html (sampling algorithm)
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

  static _fitInit (data) {
    // Seed alpha=0 (symmetric normal); MOM inversion for alpha requires sample skewness which is unreliable for small n
    const n = data.length
    const xi = data.reduce((s, x) => s + x, 0) / n
    const omega = Math.sqrt(data.reduce((s, x) => s + (x - xi) ** 2, 0) / n) || 1
    return [xi, omega, 0]
  }
}
