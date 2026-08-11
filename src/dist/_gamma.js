import normal from './_normal'

// Below this shape, EVERY one of the xoshiro128+ PRNG's 2^32 possible outputs underflows
// the boost factor exp(ln(u)/a) to exact 0.0 in float64 -- derived from the largest u the
// PRNG can produce below 1 (u_max = 1 - 2^-32) and float64's underflow boundary
// (Number.MIN_VALUE): the threshold solves ln(u_max)/a = ln(Number.MIN_VALUE).
// See decisions/0054-boosted-gamma-analytic-underflow-boundary-return.md
export const BOOST_UNDERFLOW_THRESHOLD = Math.log1p(-1 / 4294967296) / Math.log(Number.MIN_VALUE)

// Generous cap for a >= BOOST_UNDERFLOW_THRESHOLD, where the loop has a genuine (if very
// small, near the threshold) positive acceptance probability and terminates almost surely,
// but the #1379 reviewer's own estimate put worst-case iterations near ~13.4M for shapes
// just above the practically-verified boundary -- sized with comfortable margin above that.
const BOOST_MAX_ITER = 2e7

/**
 * Generates a gamma random variate for shape a < 1 via the boost identity
 * X·U^(1/a) ~ Gamma(a) for X ~ Gamma(a+1). Computed in log-space
 * (exp(ln(X) + ln(U)/a) rather than X * U^(1/a)) so the boost factor itself never
 * underflows before being combined with X. Below BOOST_UNDERFLOW_THRESHOLD the true
 * variate is, for every possible PRNG draw, provably smaller than Number.MIN_VALUE, so 0
 * is returned directly -- the correctly-rounded IEEE-754 answer, not a fabricated value
 * (ADR-0054). At or above the threshold, the #1379 rejection guard (redraw on underflow)
 * is kept, bounded by BOOST_MAX_ITER as a defensive backstop -- see rejection.js's
 * analogous MAX_ITER-bounded loop, though this bound is sized specifically for this
 * algorithm's own worst case rather than the shared, much smaller generic MAX_ITER.
 * (issues #1379, #1384)
 * See solutions/distribution/2026-08-11-1014-gamma-boost-branch-underflow-and-subnormal-reciprocal.md
 * See decisions/0054-boosted-gamma-analytic-underflow-boundary-return.md
 *
 * @method boostedGamma
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} a Shape parameter, must be less than 1.
 * @param {number} b Rate parameter.
 * @returns {number} Random variate.
 * @ignore
 */
function boostedGamma (r, a, b) {
  if (a < BOOST_UNDERFLOW_THRESHOLD) {
    return 0
  }

  for (let iter = 0; iter < BOOST_MAX_ITER; iter++) {
    const result = Math.exp(Math.log(gamma(r, a + 1, b)) + Math.log(r.next()) / a)
    if (result !== 0) {
      return result
    }
  }
  return 0
}

/**
 * Generates a gamma random variate with the rate parametrization.
 *
 * @method gamma
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} a Shape parameter.
 * @param {number} b Rate parameter.
 * @returns {number} Random variate.
 * @ignore
 */
export default function gamma (r, a, b = 1) {
  // Extra U^(1/a) draw in the boost branch pushed the a=1 KS statistic over
  // the p=0.01 threshold at N=10000 (issue #193); run M-T directly instead.
  // See solutions/distribution/2026-05-16-1851-gamma-sampler-boundary-α=1.md
  if (a >= 1) {
    const d = a - 1 / 3

    const c = 1 / Math.sqrt(9 * d)

    let Z
    let V
    let U

    // Unbounded loop; Marsaglia-Tsang acceptance rate exceeds 0.98 for a >= 1,
    // so the expected number of iterations is bounded and termination is guaranteed.
    while (true) {
      Z = normal(r)
      if (Z > -1 / c) {
        V = Math.pow(1 + c * Z, 3)
        U = r.next()
        if (Math.log(U) < 0.5 * Z * Z + d * (1 - V + Math.log(V))) { return d * V / b }
      }
    }
  } else {
    return boostedGamma(r, a, b)
  }
}
