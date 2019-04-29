import { EPS, MAX_ITER } from '../special/_core'

/**
 * Class implementing a recursive sum. It is initialized with the zeroth term of the sum, an updater for the term variables and a method that computes the term from the variables. If the module specified accuracy has reached, the iteration stops, otherwise the maximum number of iterations are used.
 *
 * @method recursiveSum
 * @memberOf ran.algorithms
 * @param {Object} x0 Object containing the state of the variables in the zeroth index.
 * @param {Function} updater Function that takes the current state of the variables, the current index and returns the next state of the variables.
 * @param {Function} deltaFn Function that takes the current state of the variables and returns the term corresponding to the state.
 * @returns {number} The approximated sum.
 * @private
 */
export default function (x0, updater, deltaFn) {
  // Init state and sum
  let x = x0
  let sum = deltaFn(x)

  // Improve sum recursively
  for (let i = 1; i < MAX_ITER; i++) {
    // Update state
    x = updater(x, i)

    // Update delta and sum
    let delta = deltaFn(x)
    sum += delta

    // Check if accuracy has reached
    if (Math.abs(delta / sum) < EPS) {
      return sum
    }
  }
  return sum
}