import { MAX_ITER, EPS } from '../core/constants'

function _halley (z, w0) {
  let w = w0
  let dw = 0

  for (let i = 0; i < MAX_ITER; i++) {
    const expw = Math.exp(w)
    const y = w * expw - z
    if (y === 0) { break }
    dw = y / ((w + 1) * expw - (w + 2) * y / (2 * w + 2))
    w -= dw
    // Hybrid absolute/relative criterion avoids false convergence when w ≈ 0
    if (Math.abs(dw) < EPS * Math.max(Math.abs(w), 1)) { break }
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
  let w0
  if (z >= -0.1) {
    // Logarithmic Laurent approximation for z near 0: Chapeau-Blondeau & Monir (2002)
    const l1 = Math.log(-z)
    w0 = l1 - Math.log(-l1)
  } else {
    // Series around the branch point z = -1/e: Corless et al. (1996) §4
    const p = Math.sqrt(2 * (1 + Math.E * z))
    w0 = -1 - p - p * p / 3 - 11 * p * p * p / 72
  }
  return _halley(z, w0)
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
