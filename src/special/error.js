import {
  gammaLowerIncomplete,
  gammaUpperIncomplete
} from './gamma-incomplete'
import newton from '../algorithms/newton'

const CErfInv = [
  0.0833333333333333,
  0.0145833333333333,
  0.0031498015873016,
  0.00075248704806,
  0.0001907475361251
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
    ? -gammaLowerIncomplete(0.5, x * x)
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
  const x2 = x * x
  let c = 0.5 * Math.pow(Math.PI, 5.5)
  for (let i = CErfInv.length - 1; i >= 0; i--) {
    x0 = (x0 + CErfInv[i] * c) * x2
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
