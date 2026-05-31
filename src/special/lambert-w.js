import { MAX_ITER, EPS } from '../core/constants'

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
 * @method lambertW1m
 * @memberof ran.special
 * @param {number} z Value to evaluate the Lambert W function at. Valid range: [-1/e, 0).
 * @returns {number} Value of the Lambert W function, or NaN if z is outside [-1/e, 0).
 * @private
 */
export function lambertW1m (z) {
  if (z < -Math.exp(-1) || z >= 0) {
    return NaN
  }
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
 * @param {number} z Value to evaluate the Lambert W function at. Valid range: [-1/e, ∞).
 * @returns {number} Value of the Lambert W function, or NaN if z < -1/e.
 * @private
 */
export function lambertW0 (z) {
  if (z < -Math.exp(-1)) {
    return NaN
  }
  return _halley(z, z < 1 ? 0 : Math.log(z))
}
