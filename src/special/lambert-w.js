import { MAX_ITER, EPS, DELTA } from './_core'

/**
 * Computes the Lambert W function using Halley's method.
 * Source: https://cs.uwaterloo.ca/research/tr/1993/03/W.pdf
 *
 * @method lambertW
 * @memberOf ran.special
 * @param {number} z Value to evaluate the Lambert W function at.
 * @returns {number} Value of the Lambert W function.
 * @private
 */
export default function (z) {
  let w = z < 1 ? 0 : Math.log(Math.max(z, DELTA))
  let dw = 0

  for (let i = 0; i < MAX_ITER; i++) {
    let y = w * Math.exp(w) - z
    dw = y / ((w + 1) * Math.exp(w) - (w + 2) * y / (2 * w + 2))
    w -= dw
    if (Math.abs(dw / w) < EPS) { break }
  }

  return w
}
