import { besselI } from '../special'
import Distribution from './_distribution'
import { EPS, MAX_ITER, MAX_SERIES_ITER } from '../core/constants'

/**
 * Probability density function for the [von Mises distribution]{@link https://en.wikipedia.org/wiki/Von_Mises_distribution}:
 *
 * $f(x; \kappa) = \frac{e^{\kappa \cos(x)}}{2 \pi I_0(\kappa)},$
 *
 * with $\kappa > 0$. Support: $x \in \[-\pi, \pi\]$. Note that originally this distribution is periodic and therefore it is defined over $\mathbb{R}$, but (without the loss of general usage) this implementation still does limit the support on the bounded interval $\[-\pi, \pi\]$.
 *
 * @class VonMises
 * @memberof ran.dist
 * @constructor
 */
export default class VonMises extends Distribution {
  /**
   * @param {number} kappa Shape parameter.
   */
  constructor (kappa) {
    super('continuous', 1)

    // Validate parameters
    this.p = { kappa }
    Distribution.validate({ kappa }, [
      'kappa > 0'
    ])

    // Set support
    this.s = [{
      value: -Math.PI,
      closed: true
    }, {
      value: Math.PI,
      closed: true
    }]

    // Speed-up constants
    this.c = {
      besselI0Kappa: besselI(0, kappa),
      ratioUnifScale: kappa > 1.3 ? 1 / Math.sqrt(kappa) : Math.PI * Math.exp(-kappa)
    }
  }

  static _fitInit (data) {
    // Circular MOM: resultant length R̄ → Fisher kappa approximation R̄(2−R̄²)/(1−R̄²)
    const n = data.length
    const C = data.reduce((s, x) => s + Math.cos(x), 0) / n
    const S = data.reduce((s, x) => s + Math.sin(x), 0) / n
    const Rbar = Math.sqrt(C * C + S * S)
    const kappa = Rbar < 0.97
      ? Rbar * (2 - Rbar * Rbar) / (1 - Rbar * Rbar)
      : 10
    return [Math.max(1e-3, kappa)]
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
        return theta
      } else {
        if (this.p.kappa * Math.cos(theta) < 2 * Math.log(R1) + this.p.kappa) {
          continue
        }
        return theta
      }
    }
  }

  _pdf (x) {
    return Math.exp(this.p.kappa * Math.cos(x)) / (2 * Math.PI * this.c.besselI0Kappa)
  }

  _cdf (x) {
    // F(x) is computed according to the sum in https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_vonmises.html
    //
    // Convergence cannot be checked on the raw term besselI(i, kappa) * sin(i*x) / i: at
    // x = k*pi/4, sin(4x) (and sin(8x), ...) vanishes to machine-epsilon by pure floating-point
    // coincidence, independent of how far besselI(i, kappa)/besselI0Kappa has actually decayed.
    // For kappa gtrsim 6-9 that ratio is still large at i=4, so a check on the raw oscillating
    // term declares convergence ~10+ orders too early. |sin| <= 1 bounds the term by its envelope
    // besselI(i, kappa) / (besselI0Kappa * i), so checking convergence on the envelope instead
    // is both immune to the spurious sin zero and never terminates later than the true term would
    // require.
    // See solutions/correctness/2026-07-26-1339-vonmises-cdf-oscillating-term-premature-convergence.md
    let sum = 0
    for (let i = 1; i < MAX_SERIES_ITER; i++) {
      const envelope = besselI(i, this.p.kappa) / (this.c.besselI0Kappa * i)
      sum += envelope * Math.sin(i * x)
      if (envelope < EPS * Math.max(Math.abs(sum), 1)) {
        break
      }
    }
    return 0.5 * (1 + x / Math.PI) + sum / Math.PI
  }
}
