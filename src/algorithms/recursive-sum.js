import { EPS, MAX_ITER } from '../special/_core'

/**
 * Class implementing a recursive sum. It is initialized with the zeroth term of the sum, an updater for the term
 * variables and a method that computes the term from the variables. If the module specified accuracy has reached, the
 * iteration stops, otherwise the maximum number of iterations are used.
 *
 * @method recursiveSum
 * @memberOf ran.algorithms
 * @param {Object} x0 Object containing the state of the variables in the zeroth index.
 * @param {Function} preUpdate Function that takes the current state of the variables, the current index and returns the
 * next state of the variables before calculating the delta.
 * @param {Function} deltaFn Function that takes the current state of the variables and returns the term corresponding
 * to the state.
 * @param {Function?} postUpdate Function that takes the current state of the variables, the current index and returns
 * the next state of the variables after calculating the delta.
 * @returns {number} The approximated sum.
 * @private
 */
export default function (x0, preUpdate, deltaFn, postUpdate) {
  // Init state and sum
  let x = x0
  let sum = deltaFn(x)
  if (postUpdate) {
    x = postUpdate(x, 0)
  }

  // Improve sum recursively
  for (let i = 1; i < MAX_ITER; i++) {
    // Update state
    x = preUpdate(x, i)

    // Update delta and sum
    const delta = deltaFn(x)
    sum += delta

    // Check if accuracy has reached
    if (Math.abs(delta / sum) < EPS) {
      break
    } else {
      // Update state
      if (postUpdate) {
        x = postUpdate(x, i)
      }
    }
  }
  return sum
}
