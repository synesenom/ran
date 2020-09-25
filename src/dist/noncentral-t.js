import recursiveSum from '../algorithms/recursive-sum'
import { erf } from '../special/error'
import logGamma from '../special/log-gamma'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import { normal, chi2 } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [non-central t distribution]{@link https://en.wikipedia.org/wiki/Noncentral_t-distribution}:
 *
 * $$f(x; \nu, \mu) = \frac{\nu^\frac{\nu}{2} \exp\Big(-\frac{\nu \mu^2}{2 (x^2 + \nu)}\Big)}{\sqrt{\pi} \Gamma\big(\frac{\nu}{2}\big) 2^\frac{\nu - 1}{2} (x^2 + \nu)^\frac{\nu + 1}{2}} \int_0^\infty y^\nu \exp\bigg(-\frac{1}{2}\bigg\[y - \frac{\mu x}{\sqrt{x^2 + \nu}}\bigg\]^2\bigg) \mathrm{d}y,$$
 *
 * with $\nu \in \mathbb{N}^+$ and $\mu \in \mathbb{R}$. Support: $x \in \mathbb{R}$.
 *
 * @class NoncentralT
 * @memberof ran.dist
 * @param {number=} nu Degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 1.
 * @param {number=} mu Non-centrality parameter. Default value is 1.
 * @constructor
 */
class NoncentralT extends Distribution {
  constructor (nu = 1, mu = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    const nui = Math.round(nu)
    this.p = { nu: nui, mu }
    Distribution.validate({ nu: nui, mu }, [
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
    const mu2 = mu * mu / 2
    this.c = [
      Math.sqrt(1 + 2 / nui),
      Math.exp(logGamma((nui + 1) / 2) - logGamma(nui / 2) - mu2) / Math.sqrt(Math.PI * nui)
    ]
  }

  /**
   * Calculates the cumulative distribution function for a specific pairs of parameters and value.
   * Source: http://www.ucs.louisiana.edu/~kxk4695/CSDA-03.pdf
   *
   * @method fnm
   * @methodOf ran.dist.NoncentralT
   * @param {number} nu Degrees of freedom.
   * @param {number} mu Non-centrality parameter.
   * @param {number} x Value to evaluate distribution function at.
   * @returns {number} The cumulative probability.
   * @static
   * @ignore
   */
  static fnm (nu, mu, x) {
    // If mu = 0, return CDF for central t
    if (Math.abs(mu) < Number.EPSILON) {
      return x > 0
        ? 1 - 0.5 * regularizedBetaIncomplete(nu / 2, 0.5, nu / (x * x + nu))
        : 0.5 * regularizedBetaIncomplete(nu / 2, 0.5, nu / (x * x + nu))
    }

    const delta = x < 0 ? -mu : mu
    const phi = 0.5 * (1 + erf(-delta / Math.SQRT2))

    // If x = 0, return normal part
    if (Math.abs(x) < Number.EPSILON) {
      return phi
    }

    // Initialize iterators
    const y = x * x / (nu + x * x)
    const mu2 = delta * delta / 2
    const nu2 = nu / 2
    const k0 = Math.floor(mu2)
    const gnu = logGamma(nu2)
    const gk1 = logGamma(k0 + 1)
    const gk15 = logGamma(k0 + 1.5)
    const ly = Math.log(y)
    const p0 = Math.exp(-mu2 - logGamma(k0 + 1) + k0 * Math.log(mu2))
    const q0 = delta * Math.exp(-mu2 - logGamma(k0 + 1.5) + k0 * Math.log(mu2)) / Math.SQRT2
    const ap = k0 + 0.5
    const aq = k0 + 1
    const apb = ap + nu2
    const aqb = aq + nu2
    const bl1y = nu2 * Math.log(1 - y)
    const gp0 = Math.exp(logGamma(k0 + nu2 + 0.5) - gnu - gk15 + ap * ly + bl1y)
    const gq0 = Math.exp(logGamma(k0 + nu2) - gnu - gk1 + (aq - 1) * ly + bl1y)
    const ip0 = regularizedBetaIncomplete(ap, nu2, y)
    const iq0 = regularizedBetaIncomplete(aq, nu2, y)

    // Forward summation
    const gq = gq0 * y * (aqb - 1) / aq
    let z = recursiveSum({
      p: p0 * mu2 / (k0 + 1),
      gp: gp0 * y * apb / (ap + 1),
      ip: ip0 - gp0,
      q: q0 * mu2 / (k0 + 1.5),
      gq: gq,
      iq: iq0 - gq
    }, (t, i) => {
      const j = i + 1
      t.p *= mu2 / (k0 + j)
      t.ip -= t.gp
      t.gp *= y * (apb + i) / (ap + j)
      t.q *= mu2 / (k0 + j + 0.5)
      t.gq *= y * (aqb + i - 1) / (aq + i)
      t.iq -= t.gq
      return t
    }, t => t.p * t.ip + t.q * t.iq)

    // Backward summation
    z += recursiveSum({
      p: p0,
      gp: gp0,
      ip: ip0,
      q: q0,
      gq: gq0 * y * (aqb - 1) / aq,
      iq: iq0
    }, (t, i) => {
      const j = i - 1
      if (j < k0) {
        t.p *= (k0 - j) / mu2
        t.gp *= (ap - j) / (y * (apb - i))
        t.ip += t.gp
        t.q *= (k0 - j + 0.5) / mu2
        t.gq *= (aq - j) / (y * (aqb - i))
        t.iq += t.gq
      } else {
        t.p = 0
        t.ip = 0
        t.q = 0
        t.iq = 0
      }
      return t
    }, t => t.p * t.ip + t.q * t.iq)

    z = z / 2 + phi
    return Math.min(Math.max(x >= 0 ? z : 1 - z, 0), 1)
  }

  _generator () {
    // Direct sampling from a normal and a chi2
    const x = normal(this.r)
    const y = chi2(this.r, this.p.nu)
    return (x + this.p.mu) / Math.sqrt(y / this.p.nu)
  }

  _pdf (x) {
    if (Math.abs(x) < Number.EPSILON) {
      return this.c[1]
    } else {
      return Math.max(0, this.p.nu * (NoncentralT.fnm(this.p.nu + 2, this.p.mu, x * this.c[0]) - NoncentralT.fnm(this.p.nu, this.p.mu, x)) / x)
    }
  }

  _cdf (x) {
    return NoncentralT.fnm(this.p.nu, this.p.mu, x)
  }
}

export default NoncentralT
