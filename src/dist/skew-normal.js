import owenT from '../special/owen-t'
import { normal } from './_core'
import Normal from './normal'
import { erf } from '../special/error'

/**
 * Generator for the [skew normal distribution]{@link https://en.wikipedia.org/wiki/Skew_normal_distribution}:
 *
 * $$f(x; \xi, \omega, \alpha) = \frac{2}{\omega} \phi\bigg(\frac{x - \xi}{\omega}\bigg) \Phi\bigg(\alpha \frac{x - \xi}{\omega}\bigg),$$
 *
 * where $\xi, \alpha > 0$, $\omega \in \mathbb{R}$ and $\phi(x)$, $\Phi(x)$ denote the probability density and cumulative distribution functions of the standard [normal distribution]{@link #dist.Normal}. Support: $x \in \mathbb{R}$.
 *
 * @class SkewNormal
 * @memberof ran.dist
 * @param {number=} xi Location parameter. Default value is 0.
 * @param {number=} omega Scale parameter. Default value is 1.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Normal {
  constructor (xi = 0, omega = 1, alpha = 1) {
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
    this.c1 = [
      delta,
      Math.sqrt(1 - delta * delta)
    ]
  }

  _generator () {
    // Method from http://azzalini.stat.unipd.it/SN/faq-r.html
    const u0 = normal(this.r)
    const v = normal(this.r)
    const u1 = this.c1[0] * u0 + this.c1[1] * v
    const z = u0 >= 0 ? u1 : -u1
    return this.p.xi + this.p.omega * z
  }

  _pdf (x) {
    return super._pdf(x) * (1 + erf(this.p.alpha * Math.SQRT1_2 * (x - this.p.xi) / this.p.omega))
  }

  _cdf (x) {
    const z = super._cdf(x) - 2 * owenT((x - this.p.xi) / this.p.omega, this.p.alpha)
    return Math.min(1, Math.max(0, z))
  }

  _q (p) {
    return this._qEstimateRoot(p)
  }
}
