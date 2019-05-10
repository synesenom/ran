import recursiveSum from '../algorithms/recursive-sum'
import { erf } from '../special/error'
import logGamma from '../special/log-gamma'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import { normal, gamma } from './_core'
import Distribution from './_distribution'
import { EPS } from '../special/_core'

/**
 * Generator for the [non-central t distribution]{@link https://en.wikipedia.org/wiki/Noncentral_t-distribution}:
 *
 * $$f(x; \nu, \mu) = \frac{\nu^\frac{\nu}{2} \exp\Big(-\frac{\nu \mu^2}{2 (x^2 + \nu)}\Big)}{\sqrt{\pi} \Gamma\big(\frac{\nu}{2}\big) 2^\frac{\nu - 1}{2} (x^2 + \nu)^\frac{\nu + 1}{2}} \int_0^\infty y^\nu \exp\bigg(-\frac{1}{2}\bigg[y - \frac{\mu x}{\sqrt{x^2 + \nu}}\bigg]^2\bigg) \mathrm{d}y,$$
 *
 * with \(\nu \in \mathbb{N}^+\) and \(\mu \in \mathbb{R}\). Support: \(x \in \mathbb{R}\).
 *
 * @class NoncentralT
 * @memberOf ran.dist
 * @param {number=} nu Degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 1.
 * @param {number=} mu Non-centrality parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (nu = 1, mu = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    let nui = Math.round(nu)
    this.p = { nu: nui, mu }
    Distribution._validate({ nu: nui, mu }, [
      'nu > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _fnm(nu, mu, x) {
    // If mu = 0, return CDF for central t
    if (Math.abs(mu) < Number.EPSILON) {
      return x > 0
        ? 1 - 0.5 * regularizedBetaIncomplete(nu / 2, 0.5, nu / (x * x + nu))
        : 0.5 * regularizedBetaIncomplete(nu / 2, 0.5, nu / (x * x + nu))
    }

    let delta = x < 0 ? -mu : mu
    let pnorm = 0.5 * (1 + erf(-delta / Math.SQRT2))

    // If x = 0, return normal part
    if (Math.abs(x) < Number.EPSILON) {
      return pnorm
    }

    // Otherwise, compute sum
    let y = x * x / (nu + x * x)
    let mu2 = delta * delta / 2
    let k = Math.floor(mu2)
    let ap = k + 0.5
    let aq = k + 1
    let b = nu / 2
    let p = Math.exp(-mu2 - logGamma(k + 1) + k * Math.log(mu2))
    let q = Math.exp(-mu2 - logGamma(k + 1.5) + k * Math.log(mu2))
    let gp = Math.exp(logGamma(ap + b) - logGamma(ap + 1) - logGamma(b) + ap * Math.log(y) + b * Math.log(1 - y))
    let gpf = Math.exp(logGamma(ap + b) - logGamma(ap + 1) - logGamma(b) + ap * Math.log(y) + b * Math.log(1 - y))
    let gq = Math.exp(logGamma(aq + b - 1) - logGamma(aq) - logGamma(b) + (aq - 1) * Math.log(y) + b * Math.log(1 - y))
    let ip = regularizedBetaIncomplete(ap, b, y)
    let iq = regularizedBetaIncomplete(aq, b, y)
    //console.log(k, p * ip + delta * q * iq / Math.SQRT2)
    let z = recursiveSum({
      stop: false,
      term: p * ip + delta * q * iq / Math.SQRT2,
      rempois: 1 - p,
      error: 1,

      // Forward variables
      pf: p, qf: q,
      gpf: gpf, gqf: gq,
      ipf: ip, iqf: iq,

      // Backward variables
      pb: p, qb: q,
      gpb: gp,// * y * (ap + b - 1) / ap,
      gqb: gq * y * (aq + b - 1) / aq,
      ipb: ip, iqb: iq
    }, (t, i) => {
      // Check if we need to stop
      if (t.stop) {
        t.term = 0
        return t
      }

      // Forward
      //t.gpf *= y * (ap + b + i - 2) / (ap + i - 1)
      t.ipf -= t.gpf
      t.gpf *= y * (ap + b + i - 1) / (ap + i)
      t.pf *= mu2 / (k + i)
      t.gqf *= y * (aq + b + i - 2) / (aq + i - 1)
      t.iqf -= t.gqf
      t.qf *= mu2 / (k + i + 0.5)
      t.term = t.pf * t.ipf + delta * t.qf * t.iqf / Math.SQRT2

      // Stopping rule variables
      t.error = t.rempois * t.ipf * (1 + Math.abs(delta) / 2) / 2
      t.rempois -= t.pf

      if (i > k) {
        if (t.error < EPS) {
          t.stop = true
        }
      } else {
        // Backward
        t.gpb *= (ap - i + 1) / (y * (ap + b - i))
        t.ipb += t.gpb
        t.pb *= (k - i + 1) / mu2
        t.gqb *= (aq - i + 1) / (y * (aq + b - i))
        t.iqb += t.gqb
        t.qb *= (k - i + 1.5) / mu2
        t.term += t.pb * t.ipb + delta * t.qb * t.iqb / Math.SQRT2

        // Stopping condition
        t.rempois -= t.pb

        if (t.rempois <= EPS) {
          t.stop = true
        }
      }
      //console.log(k + i, t.pf, t.qf, t.gpf, t.gqf, t.ipf, t.iqf)
      //console.log(k - i, t.pb, t.qb, t.gpb, t.gqb, t.ipb, t.iqb)
      //console.log(k + i, t.pf * t.ipf + delta * t.qf * t.iqf / Math.SQRT2)
      if (i <= k) {
        //console.log(k - i, t.pb * t.ipb + delta * t.qb * t.iqb / Math.SQRT2)
      }
      return t
    }, t => t.term)

    /*if (!Number.isFinite(z) || isNaN(z)) {
      console.log(nu, mu, x, ap + b - 1, logGamma(ap + b - 1))
    }*/

    z = z / 2 + pnorm
    return Math.min(Math.max(x >= 0 ? z : 1 - z, 0), 1)
  }

  _generator () {
    // Direct sampling from a normal and a chi2
    let x = normal(this.r)
    let y = gamma(this.r, this.p.nu / 2, 0.5)
    return (x + this.p.mu) / Math.sqrt(y / this.p.nu)
  }

  _pdf (x) {
    if (Math.abs(x) < Number.EPSILON) {
      return Math.exp(logGamma((this.p.nu + 1) / 2) - logGamma(this.p.nu / 2) - this.p.mu * this.p.mu / 2) / Math.sqrt(Math.PI * this.p.nu)
    } else {
      return Math.max(0, this.p.nu * (this._fnm(this.p.nu + 2, this.p.mu, x * Math.sqrt(1 + 2 / this.p.nu)) - this._fnm(this.p.nu, this.p.mu, x)) / x)
    }
  }

  _cdf (x) {
    // Source: http://www.ucs.louisiana.edu/~kxk4695/CSDA-03.pdf
    return this._fnm(this.p.nu, this.p.mu, x)
  }
}