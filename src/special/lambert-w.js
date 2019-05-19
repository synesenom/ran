import { MAX_ITER, EPS } from './_core'

function _halley (z, w0) {
  let w = w0
  let dw = 0

  for (let i = 0; i < MAX_ITER; i++) {
    let y = w * Math.exp(w) - z
    dw = y / ((w + 1) * Math.exp(w) - (w + 2) * y / (2 * w + 2))
    w -= dw
    if (Math.abs(dw / w) < EPS) { break }
  }

  return w
}

/**
 * Computes the Lambert W function (principal branch) using Halley's method.
 * Source: https://cs.uwaterloo.ca/research/tr/1993/03/W.pdf
 *
 * @method lambertW0
 * @memberOf ran.special
 * @param {number} z Value to evaluate the Lambert W function at.
 * @returns {number} Value of the Lambert W function.
 * @private
 */
export function lambertW0 (z) {
  return _halley(z, z < 1 ? 0 : Math.log(z))
}

/**
 * Computes the Lambert W function (lower branch) using Halley's method.
 * Source: https://cs.uwaterloo.ca/research/tr/1993/03/W.pdf
 *
 * @method lambertW1
 * @memberOf ran.special
 * @param {number} z Value to evaluate the Lambert W function at.
 * @returns {number} Value of the Lambert W function.
 * @private
 */
export function lambertW1 (z) {
  return _halley(z, -2)
}
