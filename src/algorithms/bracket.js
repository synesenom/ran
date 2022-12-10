import { MAX_ITER } from '../core/constants'

// Scaling factor to speed up explorations.
const SCALE = 1.618

/**
 * Estimates brackets around the root of a function. If there are no constraints specified, the bracket interval
 * grows without limits with a scaling factor of 1.618. Otherwise, the interval is limited to the boundary specified in
 * the constraints. If the constraining interval has an open boundary, the boundary is approached with a distance
 * shrinking with a factor of 1.618 in each step.
 *
 * @method bracket
 * @memberof ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {number} a0 Initial lower boundary of the bracket.
 * @param {number} b0 Initial upper boundary of the bracket.
 * @param {Object[]=} s Object containing the constraints on the lower and upper bracket. Each constraint has a
 * <code>closed</code> and <code>value</code> property denoting if the constraint is a closed interval and the value of
 * the boundaries. If not set, (-inf, inf) is applied.
 * @return {(number[]|undefined)} Array containing the bracket around the root if successful, undefined otherwise.
 * @private
 */
export default function (f, a0, b0, s) {
  // If initial boundaries are invalid, return undefined.
  if (a0 === b0) {
    return
  }

  // Initialize variables.
  let a = Math.min(a0, b0)
  const min = s ? s[0].value : -Infinity
  let deltaA = s && s[0].closed ? 0 : 1
  let b = Math.max(a0, b0)
  const max = s ? s[1].value : Infinity
  let deltaB = s && s[1].closed ? 0 : 1
  let fa = f(a)
  let fb = f(b)
  let expansion

  // Start searching.
  for (let k = 0; k < MAX_ITER; k++) {
    // If we have different signs, we are done.
    if (fa * fb < 0.0) {
      return [a, b]
    }

    // If lower boundary has a smaller value, extend to the left while respecting the support.
    expansion = SCALE * (b - a)
    if (Math.abs(fa) < Math.abs(fb)) {
      a = Math.max(a - expansion, min + deltaA)
      deltaA /= SCALE
      fa = f(a)
    } else if (Math.abs(fa) > Math.abs(fb)) {
      // If upper boundary has a smaller value, extend to the right while respecting the support.
      b = Math.min(b + expansion, max - deltaB)
      deltaB /= SCALE
      fb = f(b)
    } else {
      // If they have the same value, extend in both sides.
      a = Math.max(a - expansion, min + deltaA)
      deltaA /= SCALE
      fa = f(a)
      b = Math.min(b + expansion, max + deltaB)
      deltaB /= SCALE
      fb = f(b)
    }
  }

  // Return boundary anyway.
  // TODO Should return b0 || b if this breaks down.
  return [a0 || a, b0]
}
