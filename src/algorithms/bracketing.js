import { MAX_ITER } from '../special/_core'

/**
 * Estimates brackets around the root of a function.
 *
 * @method bracket
 * @methodOf ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {number} a0 Initial lower boundary of the bracket.
 * @param {number} b0 Initial upper boundary of the bracket.
 * @return {(number[]|undefined)} Array containing the bracket around the root if successful, undefined otherwise.
 * @private
 */
export default function(f, a0, b0) {
  // If initial boundaries are invalid, return null
  if (a0 === b0) {
    return undefined
  }

  // Start searching
  let a = a0
  let b = b0
  let f1 = f(a)
  let f2 = f(b)
  for (let k = 0; k < MAX_ITER; k++) {
    if (f1 * f2 < 0.0) {
      return [a, b]
    }
    if (Math.abs(f1) < Math.abs(f2)) {
      f1 = f(a += 1.6 * (a - b))
    } else {
      f2 = f(a += 1.6 * (b - a))
    }
  }

  return undefined
}
