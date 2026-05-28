import { regularizedBetaIncomplete, beta } from '../special'
import { MAX_ITER, EPS } from '../core/constants'
import sign from './_sign'
import gamma from './_gamma'
import Distribution from './_distribution'

/**
 * Generator for [Student's t-distribution]{@link https://en.wikipedia.org/wiki/Student%27s_t-distribution}:
 *
 * $f(x; \nu) = \frac{1}{\sqrt{\nu}\mathrm{B}\big(\frac{1}{2}, \frac{\nu}{2}\big)} \Big(1 + \frac{x^2}{\nu}\Big)^{-\frac{\nu + 1}{2}},$
 *
 * with $\nu > 0$ and $\mathrm{B}(x, y)$ is the beta function. Support: $x \in \mathbb{R}$.
 *
 * @class StudentT
 * @memberof ran.dist
 * @constructor
 */
export default class StudentT extends Distribution {
  /**
   * @param {number} nu Degrees of freedom.
   */
  constructor (nu) {
    super('continuous', 1)

    // Validate parameters
    this.p = { nu }
    Distribution.validate({ nu }, [
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

    // Pre-compute constants for _pdf and the hot path in _q
    const nu2 = nu * nu
    this.c = {
      betaNorm: 1 / (Math.sqrt(nu) * beta(0.5, nu / 2)),
      sqrtNu: Math.sqrt(nu),
      halfNu1: (nu + 1) / 2,
      nu2,
      nu3: nu2 * nu,
      nu4: nu2 * nu2
    }
  }

  static _fitInit (data) {
    // variance = ν/(ν−2) ⇒ ν = 2·Var/(Var−1) for Var>1; heavy-tailed default otherwise.
    // Cap ν: variance just above 1 explodes the estimate into a near-degenerate (≈normal) seed
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n
    return [variance > 1 ? Math.min(2 * variance / (variance - 1), 1000) : 10]
  }

  _generator () {
    // Direct sampling using gamma variates
    return sign(this.r) * Math.sqrt(this.p.nu * gamma(this.r, 0.5) / gamma(this.r, this.p.nu / 2))
  }

  _pdf (x) {
    return this.c.betaNorm * Math.pow(1 + x * x / this.p.nu, -this.c.halfNu1)
  }

  _cdf (x) {
    return x > 0
      ? 1 - 0.5 * regularizedBetaIncomplete(this.p.nu / 2, 0.5, this.p.nu / (x * x + this.p.nu))
      : 0.5 * regularizedBetaIncomplete(this.p.nu / 2, 0.5, this.p.nu / (x * x + this.p.nu))
  }

  _q (p) {
    // nu=1 is the Cauchy distribution with an exact closed-form quantile;
    // the Cornish-Fisher series diverges at nu=1 so this fast path is essential.
    if (this.p.nu === 1) {
      return Math.tan(Math.PI * (p - 0.5))
    }

    // Reduce to p > 0.5 via symmetry
    if (p < 0.5) {
      return -this._q(1 - p)
    }

    // Cornish-Fisher expansion (A&S §26.7.8) from the normal quantile as seed;
    // 4 correction terms give ~4-digit accuracy for nu >= 3, reducing Halley steps
    // from ~5 (2-term) to ~2.
    //
    // A&S §26.2.17 rational approximation is used instead of erfinv because erfinv
    // requires Newton iteration internally, making it ~100× slower than this
    // closed-form expression (log + sqrt + polynomial arithmetic).
    // See solutions/performance/2026-05-24-0630-erfinv-as-seed-negates-newton-speedup.md
    const s = Math.sqrt(-2 * Math.log(1 - p))
    const z = s - (2.515517 + s * (0.802853 + s * 0.010328)) /
      (1 + s * (1.432788 + s * (0.189269 + s * 0.001308)))
    const z2 = z * z
    const z3 = z2 * z
    const z5 = z3 * z2
    const z7 = z5 * z2
    const z9 = z7 * z2
    let t = z +
      (z3 + z) / (4 * this.p.nu) +
      (5 * z5 + 16 * z3 + 3 * z) / (96 * this.c.nu2) +
      (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * this.c.nu3) +
      (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92160 * this.c.nu4)

    // Halley refinement: cubic convergence via log-derivative of the t-pdf,
    // d/dt ln f(t) = -(nu+1)*t/(nu+t²), at cost of 3 extra arithmetic ops per step.
    // Check terminates BEFORE applying the next step so the last applied t is kept.
    // dtAbsMin detects the IBF noise floor: when |dt| stops decreasing, further steps
    // only add floating-point noise regardless of nu. 4*EPS covers cases where IBF
    // already delivers near-machine-epsilon accuracy and |dt| drops below that band.
    // tPrev is a period-2 safety net for the rare case the noise floor isn't monotone.
    // See solutions/performance/2026-05-24-1430-halley-higher-period-oscillation-ibf-noise-floor.md
    let tPrev = NaN
    let dtAbsMin = Infinity
    for (let i = 0; i < MAX_ITER; i++) {
      const dt = (this._cdf(t) - p) / this._pdf(t)
      const dtAbsCurr = Math.abs(dt)
      if (dtAbsCurr <= 4 * EPS * Math.max(Math.abs(t), 1) || dtAbsCurr >= dtAbsMin) {
        break
      }
      const tOld = t
      t -= dt / (1 + dt * (this.p.nu + 1) * t / (2 * (this.p.nu + t * t)))
      if (t === tPrev) {
        break
      }
      tPrev = tOld
      dtAbsMin = dtAbsCurr
    }
    return t
  }
}
