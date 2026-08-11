import { MAX_ITER } from '../core/constants'
import gamma, { BOOST_UNDERFLOW_THRESHOLD } from './_gamma'

// Resolves which boundary a resample cannot escape from, once at least one shape parameter
// is provably underflowing every gamma() draw to exactly 0 (decisions/0054-boosted-gamma-
// analytic-underflow-boundary-return.md). ln(x/y) ~ E_y/b - E_x/a (same small-shape tail
// asymptotic as the ADR), so z = x/(x+y) = sigmoid(ln(x)-ln(y)) is pulled toward the boundary
// the smaller shape parameter's draw loses the vanishing race to: a < b pulls x closer to 0
// (z -> 0), a > b pulls y closer to 0 (z -> 1), and a === b is a symmetric coin flip.
function _underflowBoundary (r, a, b) {
  if (a < b) return 0
  if (a > b) return 1
  return r.next() < 0.5 ? 0 : 1
}

/**
 * Generates a beta distributed random variate.
 *
 * @method normal
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} a First shape parameter.
 * @param {number} b Second shape parameter.
 * @returns {number} Random variate.
 * @ignore
 */
export default function (r, a, b) {
  // When a and b are BOTH below the threshold, x and y are provably exactly 0 on every
  // attempt, so z = x / (x + y) is 0 / 0 -> NaN on every attempt -- no amount of resampling
  // helps (issue #1384), so this is resolved directly rather than entering the loop below.
  if (a < BOOST_UNDERFLOW_THRESHOLD && b < BOOST_UNDERFLOW_THRESHOLD) {
    return _underflowBoundary(r, a, b)
  }

  // Only reachable here when at most one of a/b is below the threshold, so any exhaustion
  // is one shape provably underflowing to exactly 0 with the other representable -- z
  // provably always lands on the same boundary. MAX_ITER-capped as a defensive backstop
  // (issues #1379, #1384); a single draw already resolves this case (0 / y = 0 or
  // x / x = 1 on the first attempt), so the loop below only ever iterates once in
  // practice, but is kept for structural symmetry with the double-underflow guard above.
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const x = gamma(r, a, 1)
    const y = gamma(r, b, 1)
    const z = x / (x + y)
    if (Number.isFinite(z)) {
      // Handle 1 - z << 1 case
      return Math.abs(1 - z) < Number.EPSILON ? 1 - y / x : z
    }
  }
  return _underflowBoundary(r, a, b)
}
