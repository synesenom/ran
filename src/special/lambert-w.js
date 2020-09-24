import { MAX_ITER, EPS } from './_core'

function _halley (z, w0) {
  let w = w0
  let dw = 0

  for (let i = 0; i < MAX_ITER; i++) {
    const y = w * Math.exp(w) - z
    dw = y / ((w + 1) * Math.exp(w) - (w + 2) * y / (2 * w + 2))
    w -= dw
    if (Math.abs(dw / w) < EPS) { break }
  }

  return w
}

/**
 * Computes the Lambert W function (branch -1) using Halley's method.
 * Source: Corless et al: On the Lambert W Function (https://cs.uwaterloo.ca/research/tr/1993/03/W.pdf)
 *
 * @method lamberW1m
 * @memberof ran.special
 * @param z {number} Value to evaluate the Lambert W function at.
 * @returns {number} Value of the Lambert W function.
 * @private
 */
export function lambertW1m (z) {
  // TODO Find better w0
  return _halley(z, -2)
}

/**
 * Computes the Lambert W function (principal branch) using Halley's method.
 * Source: Corless et al: On the Lambert W Function (https://cs.uwaterloo.ca/research/tr/1993/03/W.pdf)
 *
 *
 * @method lambertW0
 * @memberof ran.special
 * @param {number} z Value to evaluate the Lambert W function at.
 * @returns {number} Value of the Lambert W function.
 * @private
 */
export function lambertW0 (z) {
  return _halley(z, z < 1 ? 0 : Math.log(z))
}
