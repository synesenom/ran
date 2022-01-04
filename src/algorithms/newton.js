import { MAX_ITER, EPS } from '../special/_core'

/**
 * Finds the root of a function using [Newton's method]{@link https://en.wikipedia.org/wiki/Newton's_method}.
 * This is a direct implementation of the method but still useful for some simple cases.
 *
 * @method newton
 * @memberof ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {Function} df First derivative of the function. Must accept a single variable.
 * @param {number} x0 Starting point of the optimization.
 * @return {(number|undefined)} The root of the specified function.
 * @private
 */
export default function (f, df, x0) {
  let x = x0
  let dx
  let d

  for (let k = 0; k < MAX_ITER; k++) {
    // Evaluate derivative.
    d = df(x)

    // If derivative is zero, evaluate the function at a close neighboring point.
    dx = f(x) / (Math.abs(d) > EPS ? d : df(x + EPS))
    x -= dx

    // Exit if we reached precision level.
    if (Math.abs(dx / x) < EPS) {
      break
    }
  }

  return x
}
