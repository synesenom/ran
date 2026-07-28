import { besselI } from '../special'
import Distribution from './_distribution'
import { EPS, MAX_ITER, MAX_SERIES_ITER } from '../core/constants'

let warnedLegacyConstructor = false

/**
 * Probability density function for the [von Mises distribution]{@link https://en.wikipedia.org/wiki/Von_Mises_distribution}:
 *
 * $f(x; \mu, \kappa) = \frac{e^{\kappa \cos(x - \mu)}}{2 \pi I_0(\kappa)},$
 *
 * with $\mu \in \mathbb{R}$ and $\kappa > 0$. Support: $x \in \[\mu - \pi, \mu + \pi\]$. Note that originally this distribution is periodic and therefore it is defined over $\mathbb{R}$, but (without the loss of general usage) this implementation still does limit the support on the bounded interval $\[\mu - \pi, \mu + \pi\]$.
 *
 * @class VonMises
 * @memberof ran.dist
 * @constructor
 */
export default class VonMises extends Distribution {
  /**
   * @param {number} mu Location parameter (mean direction).
   * @param {number} kappa Concentration parameter (shape).
   */
  constructor (mu, kappa) {
    super('continuous', 2)

    // Accept the deprecated single-argument form new VonMises(kappa), which implicitly
    // centered the distribution at mu = 0.
    let muValue = mu
    let kappaValue = kappa
    if (kappa === undefined && mu !== undefined) {
      VonMises._warnLegacyConstructor()
      kappaValue = mu
      muValue = 0
    }

    // Validate parameters
    this.p = { mu: muValue, kappa: kappaValue }
    Distribution.validate({ mu: muValue, kappa: kappaValue }, [
      'kappa > 0'
    ])

    // Set support
    this.s = [{
      value: muValue - Math.PI,
      closed: true
    }, {
      value: muValue + Math.PI,
      closed: true
    }]

    // Speed-up constants
    this.c = {
      besselI0Kappa: besselI(0, kappaValue),
      ratioUnifScale: kappaValue > 1.3 ? 1 / Math.sqrt(kappaValue) : Math.PI * Math.exp(-kappaValue)
    }
  }

  _generator () {
    // Sampling method from here: http://sa-ijas.stat.unipd.it/sites/sa-ijas.stat.unipd.it/files/417-426.pdf
    // Source: Barabesi. Generating von Mises variates by the ratio-of-uniforms method. Statistica Applicata 7 (4), 1995.
    for (let i = 0; i < MAX_ITER; i++) {
      const R1 = this.r.next()
      const R2 = this.r.next()
      const theta = this.c.ratioUnifScale * (2 * R2 - 1) / R1
      if (Math.abs(theta) > Math.PI) {
        continue
      }

      if (this.p.kappa * theta * theta < 4 - 4 * R1) {
        return this.p.mu + theta
      }
      if (this.p.kappa * Math.cos(theta) < 2 * Math.log(R1) + this.p.kappa) {
        continue
      }
      return this.p.mu + theta
    }
  }

  _pdf (x) {
    return Math.exp(this.p.kappa * Math.cos(x - this.p.mu)) / (2 * Math.PI * this.c.besselI0Kappa)
  }

  _cdf (x) {
    // F(x) is computed according to the sum in https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_vonmises.html,
    // shifted by mu since the series itself is only valid for the mu = 0, [-pi, pi] parameterization.
    //
    // Convergence cannot be checked on the raw term besselI(i, kappa) * sin(i*(x-mu)) / i: at
    // x - mu = k*pi/4, sin(4(x-mu)) (and sin(8(x-mu)), ...) vanishes to machine-epsilon by pure
    // floating-point coincidence, independent of how far besselI(i, kappa)/besselI0Kappa has
    // actually decayed. For kappa gtrsim 6-9 that ratio is still large at i=4, so a check on the
    // raw oscillating term declares convergence ~10+ orders too early. |sin| <= 1 bounds the term
    // by its envelope besselI(i, kappa) / (besselI0Kappa * i), so checking convergence on the
    // envelope instead is both immune to the spurious sin zero and never terminates later than the
    // true term would require.
    // See solutions/correctness/2026-07-26-1339-vonmises-cdf-oscillating-term-premature-convergence.md
    const dx = x - this.p.mu
    let sum = 0
    for (let i = 1; i < MAX_SERIES_ITER; i++) {
      const envelope = besselI(i, this.p.kappa) / (this.c.besselI0Kappa * i)
      sum += envelope * Math.sin(i * dx)
      if (envelope < EPS * Math.max(Math.abs(sum), 1)) {
        break
      }
    }
    return 0.5 * (1 + dx / Math.PI) + sum / Math.PI
  }

  // ─── PROTECTED STATIC ───

  static _fitInit (data) {
    // Circular MOM: resultant vector (C, S) gives mu directly as its angle, and its length
    // R̄ → Fisher kappa approximation R̄(2−R̄²)/(1−R̄²)
    const n = data.length
    const C = data.reduce((s, x) => s + Math.cos(x), 0) / n
    const S = data.reduce((s, x) => s + Math.sin(x), 0) / n
    const Rbar = Math.sqrt(C * C + S * S)
    const kappa = Rbar < 0.97
      ? Rbar * (2 - Rbar * Rbar) / (1 - Rbar * Rbar)
      : 10

    // atan2 only recovers mu modulo 2*pi, but the (unwrapped) sample values live on one
    // specific 2*pi sheet of the real line -- re-anchor the angle to the sheet nearest the
    // data's own extremes, then clamp into [xmax-pi, xmin+pi] so the fixed-width support
    // [mu-pi, mu+pi] is guaranteed to contain every sample, exactly like Uniform/Triangular's
    // _fitInit deriving their support-defining parameters directly from the sample extremes
    // (guess()'s pre-fit probe, src/dist/guess.js, requires this to not exclude VonMises).
    const xmin = Math.min(...data)
    const xmax = Math.max(...data)
    const theta = Math.atan2(S, C)
    const sheet = Math.round(((xmin + xmax) / 2 - theta) / (2 * Math.PI))
    const mu = Math.min(Math.max(theta + sheet * 2 * Math.PI, xmax - Math.PI), xmin + Math.PI)
    return [mu, Math.max(1e-3, kappa)]
  }

  // ─── PRIVATE STATIC ───

  static _warnLegacyConstructor () {
    if (warnedLegacyConstructor) {
      return
    }
    warnedLegacyConstructor = true
    console.warn('[ranjs] new VonMises(kappa) positional constructor is deprecated and will be removed in v1.33.0; use new VonMises(mu, kappa), passing mu = 0 for the previous behavior.')
  }
}
