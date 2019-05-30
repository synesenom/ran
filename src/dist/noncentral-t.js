import recursiveSum from '../algorithms/recursive-sum'
import { erf } from '../special/error'
import logGamma from '../special/log-gamma'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import { normal, gamma, chi2 } from './_core'
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

    // Speed-up constants
    let nu2 = nu / 2
    let gnu = logGamma(nu2)
    let gnu1 = logGamma(nu2 + 1)
    let mu2 = mu * mu / 2
    let k = Math.floor(mu2)
    let gk1 = logGamma(k + 1)
    let gk15 = logGamma(k + 1.5)
    this.c = [
      Math.exp(-mu2 - logGamma(k + 1) + k * Math.log(mu2)),
      Math.exp(-mu2 - logGamma(k + 1.5) + k * Math.log(mu2)) / Math.SQRT2,
      logGamma(k + 0.5 + nu2) - gk15 - gnu ,
      logGamma(k + 1.5 + nu2) - gk15 - gnu1,
      logGamma(k + nu2) - gk1 - gnu,
      logGamma(k + 1 + nu2) - gk1 - gnu1,
      Math.sqrt(1 + 2 / nu),
      Math.exp(logGamma((nu + 1) / 2) - logGamma(nu / 2) - mu2) / Math.sqrt(Math.PI * nu)
    ]
  }

  /**
   * Calculates the cumulative distribution function for a specific pairs of parameters and value.
   * Source: http://www.ucs.louisiana.edu/~kxk4695/CSDA-03.pdf
   *
   * @method _fnm
   * @methodOf ran.dist.NoncentralT
   * @param {number} nu Degrees of freedom.
   * @param {number} mu Non-centrality parameter.
   * @param {number} x Value to evaluate distribution function at.
   * @param {boolean=} alt Whether to use alternative (nu + 2) speed-up constants.
   * @returns {number} The cumulative probability.
   * @private
   */
  _fnm(nu, mu, x, alt = false) {
    // If mu = 0, return CDF for central t
    if (Math.abs(mu) < Number.EPSILON) {
      return x > 0
        ? 1 - 0.5 * regularizedBetaIncomplete(nu / 2, 0.5, nu / (x * x + nu))
        : 0.5 * regularizedBetaIncomplete(nu / 2, 0.5, nu / (x * x + nu))
    }

    let delta = x < 0 ? -mu : mu
    let phi = 0.5 * (1 + erf(-delta / Math.SQRT2))

    // If x = 0, return normal part
    if (Math.abs(x) < Number.EPSILON) {
      return phi
    }

    // Otherwise, compute sum
    let p = this.c[0]
    let q = delta * this.c[1]
    let y = x * x / (nu + x * x)
    let mu2 = delta * delta / 2
    let k = Math.floor(mu2)
    let ap = k + 0.5
    let aq = k + 1
    let b = nu / 2
    let apb = ap + b
    let aqb = aq + b
    let ly = Math.log(y)
    let bl1y = b * Math.log(1 - y)
    let gp = Math.exp((alt ? this.c[3] : this.c[2]) + ap * ly + bl1y)
    let gq = Math.exp((alt ? this.c[5] : this.c[4]) + (aq - 1) * ly + bl1y)
    let ip = regularizedBetaIncomplete(ap, b, y)
    let iq = regularizedBetaIncomplete(aq, b, y)
    let z = recursiveSum({
      stop: false,
      term: p * ip + q * iq,
      rempois: 1 - p,
      error: 1,
      j: -1,

      // Forward variables
      kf: k,
      pf: p, qf: q,
      gpf: gp, gqf: gq,
      ipf: ip, iqf: iq,

      // Backward variables
      kb: k + 1,
      pb: p, qb: q,
      gpb: gp,
      gqb: gq * y * (aqb - 1) / aq,
      ipb: ip, iqb: iq
    }, (t, i) => {
      // Check if we need to stop
      if (t.stop) {
        t.term = 0
        return t
      }

      // Iterator
      t.j++

      // Forward
      t.kf++
      t.ipf -= t.gpf
      t.gpf *= y * (apb + t.j) / (ap + i)
      t.pf *= mu2 / t.kf
      t.gqf *= y * (aqb + t.j - 1) / (aq + t.j)
      t.iqf -= t.gqf
      t.qf *= mu2 / (t.kf + 0.5)
      t.term = t.pf * t.ipf + t.qf * t.iqf

      // Stopping condition
      t.error = t.rempois * t.ipf * (0.5 + Math.abs(delta) / 4)
      t.rempois -= t.pf
      if (i > k) {
        if (t.error < EPS) {
          t.stop = true
        }
      } else {
        // Backward
        t.kb--
        t.gpb *= (ap - t.j) / (y * (apb - i))
        t.ipb += t.gpb
        t.pb *= t.kb / mu2
        t.gqb *= (aq - t.j) / (y * (aqb - i))
        t.iqb += t.gqb
        t.qb *= (t.kb + 0.5) / mu2
        t.term += t.pb * t.ipb + t.qb * t.iqb

        // Stopping condition
        t.rempois -= t.pb
        if (t.rempois <= EPS) {
          t.stop = true
        }
      }

      return t
    }, t => t.term)

    z = z / 2 + phi
    return Math.min(Math.max(x >= 0 ? z : 1 - z, 0), 1)
  }

  _generator () {
    // Direct sampling from a normal and a chi2
    let x = normal(this.r)
    let y = chi2(this.r, this.p.nu)
    return (x + this.p.mu) / Math.sqrt(y / this.p.nu)
  }

  _pdf (x) {
    if (Math.abs(x) < Number.EPSILON) {
      return this.c[7]
    } else {
      return Math.max(0, this.p.nu * (this._fnm(this.p.nu + 2, this.p.mu, x * this.c[6], true) - this._fnm(this.p.nu, this.p.mu, x)) / x)
    }
  }

  _cdf (x) {
    return this._fnm(this.p.nu, this.p.mu, x)
  }
}