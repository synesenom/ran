import owenT from '../special/owen-t'
import { normal } from './_core'
import Normal from './normal'
import { erf } from '../special/error'

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
  }

  _generator () {
    // Method from http://azzalini.stat.unipd.it/SN/faq-r.html
    let u0 = normal(this.r)
    let v = normal(this.r)
    let delta = this.p.alpha / Math.sqrt(1 + this.p.alpha * this.p.alpha)
    let u1 = delta * u0 + v * Math.sqrt(1 - delta * delta)
    let z = u0 >= 0 ? u1 : -u1
    return this.p.xi + this.p.omega * z
  }

  _pdf (x) {
    return super._pdf(x) * (1 + erf(this.p.alpha * Math.SQRT1_2 * (x - this.p.xi) / this.p.omega))
  }

  _cdf (x) {
    let z = super._cdf(x) - 2 * owenT((x - this.p.xi) / this.p.omega, this.p.alpha)
    return Math.max(0, z)
  }

  _q (p) {
    return this._qEstimateRoot(p)
  }
}
