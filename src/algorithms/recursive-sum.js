import { EPS, MAX_ITER } from '../special/_core'

/**
 * Class implementing a recursive sum. It is initialized with the zeroth term of the sum, an updater for the term
 * variables and a method that computes the term from the variables. If the module specified accuracy has reached, the
 * iteration stops, otherwise the maximum number of iterations are used.
 * This method is widely used for calculating CDFs for distributions that are only defined via computation-heavy
 * series.
 *
 * @method recursiveSum
 * @memberof ran.algorithms
 * @param {Object} x0 Object containing the state of the variables in the zeroth index. This object contains all the
 * relevant variables that are needed to calculate a term in the series.
 * @param {Function} preUpdate Function that takes the current state of the variables, the current index and returns the
 * next state of the variables before calculating the term in the series.
 * @param {Function} termFn Function that takes the current state of the variables and returns the term corresponding
 * to the state.
 * @param {Function=} postUpdate Function that takes the current state of the variables, the current index and returns
 * the next state of the variables after calculating the last term.
 * @returns {number} The approximated sum.
 * @private
 */
export default function (x0, preUpdate, termFn, postUpdate) {
  // Init state and sum for the zeroth term.
  let x = x0
  let delta
  let sum = termFn(x)
  if (postUpdate) {
    x = postUpdate(x, 0)
  }

  // Improve sum recursively.
  for (let i = 1; i < MAX_ITER; i++) {
    // Update state before computing the current term.
    x = preUpdate(x, i)

    // Compute current term and update the sum.
    delta = termFn(x)
    sum += delta

    // Check if accuracy has been reached.
    if (Math.abs(delta / sum) < EPS) {
      break
    } else {
      // Otherwise update state.
      if (postUpdate) {
        x = postUpdate(x, i)
      }
    }
  }

  // Return the sum.
  return sum
}
