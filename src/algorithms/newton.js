import { MAX_ITER, EPS } from '../special/_core'

/**
 * Finds the root of a function using Newton's method.
 *
 * @method newton
 * @memberOf ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {Function} df First derivative of the function. Must accept a single variable.
 * @param {number} x0 Starting point of the optimization.
 * @return {(number|undefined)} The root of the specified function.
 * @private
 */
export default function (f, df, x0) {
  let x = x0
  let dx, d

  for (let k = 0; k < MAX_ITER; k++) {
    d = df(x)
    // If derivative is zero, compute function for a close neighboring point
    dx = f(x) / (Math.abs(d) > EPS ? d : df(x + EPS))
    x -= dx

    // Exit if we reached precision level
    if (Math.abs(dx / x) < EPS) { break }
  }

  return x
}
