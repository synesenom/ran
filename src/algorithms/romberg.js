import { EPS } from '../core/constants'
import neumaier from './neumaier'

/**
 * Calculates the integral of a function using [Romberg's method]{@link http://en.wikipedia.org/wiki/Romberg%27s_method}.
 * This is just a cleaned up version of the example implementation on Wikipedia.
 *
 * @method romberg
 * @memberof ran.algorithms
 * @param {Function} f Function to calculate definite integral for.
 * @param {number} a Lower boundary of the integration interval.
 * @param {number} b Upper boundary of the integration interval.
 * @return {number} The approximate integral of the function.
 * @private
 */
export default function (f, a, b) {
  // Initialize updating variables.
  let h = b - a
  const R = Array.from({length: 100}, () => Array.from({length: 100}, () => 0))

  // R(0, 0)
  R[0][0] = 0.5 * h * (f(a) + f(b))
  let res = R[0][0]

  // Go through n.
  for (let n = 1; n <= 100; n++) {
    // R(n, 0)
    h = h / 2
    R[n][0] = 0.5 * R[n - 1][0]
      + h * neumaier(Array.from({length: 2**(n - 1)}, (d, k) => f(a + (2 * k + 1) * h)))

    // R(n, m)
    for (let m = 1; m <= n; m++) {
      // Calculate new term and update result.
      let term = (R[n][m - 1] - R[n - 1][m - 1]) / (4**m - 1)
      R[n][m] = R[n][m - 1] + term
      res = R[n][m]

      // Return if accuracy is reached.
      if (Math.abs(term / R[n][m]) < EPS) {
        return(res)
      }
    }
  }

  return(res)
}
