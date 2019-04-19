import {
  gammaLowerIncomplete,
  gammaUpperIncomplete
} from './gamma-incomplete'
import newton from '../algorithms/newton'

const coeffs = [
  1 / 12,
  7 / 480,
  127 / 40320,
  4369 / 5806080,
  34807 / 182476800
]

/**
 * Computes the error function.
 *
 * @method erf
 * @memberOf ran.special
 * @param {number} x Value to evaluate the error function at.
 * @returns {number} Error function value.
 * @private
 */
export function erf (x) {
  // TODO Replace with continued fraction
  return x < 0
    ? - gammaLowerIncomplete(0.5, x * x)
    : gammaLowerIncomplete(0.5, x * x)
}

/**
 * Computes the complementary error function.
 *
 * @method erfc
 * @memberOf ran.special
 * @param {number} x Value to evaluate the complementary error function at.
 * @returns {number} Complementary error function value.
 * @private
 */
export function erfc (x) {
  // TODO Replace with continued fraction
  return x < 0
    ? 1 + gammaLowerIncomplete(0.5, x * x)
    : gammaUpperIncomplete(0.5, x * x)
}

/**
 * Computes the inverse error function.
 *
 * @method erfinv
 * @methodOf ran.special
 * @param {number} x Value to evaluate the inverse error function at.
 * @return {number} The inverse error function value.
 * @private
 */
export function erfinv (x) {
  // Estimate initial guess using the polynomial
  let x0 = 0
  let c = 0.5 * Math.pow(Math.PI, 5)
  for (let i = coeffs.length - 1; i >= 0; i--) {
    x0 = (x0 + coeffs[i] * c) * x * x
    c /= Math.PI
  }
  x0 = (x0 + 1) * x

  // Polish with Newton's method
  return newton(
    t => erf(t) - x,
    t => 2 * Math.exp(-t * t) / Math.sqrt(Math.PI),
    x0
  )
}