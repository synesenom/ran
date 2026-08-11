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
    /** @type {*} */
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
    // decisions/0018-continuous-subclass-natural-params.md — nu goes into this.c so that
    // StudentZ can inherit _q after overriding this.p with its own natural parameter
    const nu2 = nu * nu
    this.c = {
      nu,
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

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.p.nu > 1 ? 0 : NaN
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { nu } = this.p
    if (nu > 2) return nu / (nu - 2)
    // 1 < nu <= 2: second moment diverges; nu <= 1: mean undefined, so variance undefined
    return nu > 1 ? Infinity : NaN
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    // symmetric +/- divergence below the threshold has no signed limit: NaN, never Infinity
    return this.p.nu > 3 ? 0 : NaN
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { nu } = this.p
    if (nu > 4) return 6 / (nu - 4)
    // 2 < nu <= 4: fourth moment diverges over finite variance; nu <= 2: variance undefined
    return nu > 2 ? Infinity : NaN
  }

  _generator () {
    // Direct sampling using gamma variates. When nu < 2, the denominator gamma draw
    // (shape nu/2 < 1) is drawn via _gamma.js's small-shape boost branch, which can
    // still return a subnormal nonzero value close to Number.MIN_VALUE even after the
    // #1379 zero-rejection fix; dividing by it overflows the ratio (and hence sqrt) to
    // Infinity, outside StudentT's real-valued support. Resample until finite. Below
    // _gamma.js's BOOST_UNDERFLOW_THRESHOLD (i.e. nu below roughly twice that), the
    // denominator draw is provably exactly 0 on every attempt
    // (decisions/0054-boosted-gamma-analytic-underflow-boundary-return.md); the numerator
    // shape is fixed at 0.5, always above the threshold, so only the denominator can
    // underflow -- the ratio provably always overflows. The true variate is not merely
    // beyond Number.MAX_VALUE but astronomically so, and Infinity is IEEE-754's own
    // correctly-rounded representation of a value that far out of range (per CLAUDE.md's
    // return-value table: a valid query whose answer diverges), not Number.MAX_VALUE,
    // which would understate it by hundreds of orders of magnitude. MAX_ITER-capped, that
    // is returned instead of looping forever. Worst case this compounds with _gamma.js's own
    // BOOST_MAX_ITER-bounded retry inside the denominator gamma() call (see the gap-zone note
    // there), but stays bounded either way -- this issue's actual requirement. (issues #1379, #1384)
    for (let iter = 0; iter < MAX_ITER; iter++) {
      const result = sign(this.r) * Math.sqrt(this.c.nu * gamma(this.r, 0.5) / gamma(this.r, this.c.nu / 2))
      if (Number.isFinite(result)) {
        return result
      }
    }
    return sign(this.r) * Infinity
  }

  _pdf (x) {
    return this.c.betaNorm * Math.pow(1 + x * x / this.c.nu, -this.c.halfNu1)
  }

  _cdf (x) {
    return x > 0
      ? 1 - 0.5 * regularizedBetaIncomplete(this.c.nu / 2, 0.5, this.c.nu / (x * x + this.c.nu))
      : 0.5 * regularizedBetaIncomplete(this.c.nu / 2, 0.5, this.c.nu / (x * x + this.c.nu))
  }

  _q (p) {
    // nu=1 is the Cauchy distribution with an exact closed-form quantile;
    // the Cornish-Fisher series diverges at nu=1 so this fast path is essential.
    if (this.c.nu === 1) {
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
      (z3 + z) / (4 * this.c.nu) +
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
      t -= dt / (1 + dt * (this.c.nu + 1) * t / (2 * (this.c.nu + t * t)))
      if (t === tPrev) {
        break
      }
      tPrev = tOld
      dtAbsMin = dtAbsCurr
    }
    return t
  }
}
