import {
  gammaLowerIncomplete,
  gammaUpperIncomplete
} from './gamma-incomplete'

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
  return x < 0
    ? 1 + gammaLowerIncomplete(0.5, x * x)
    : gammaUpperIncomplete(0.5, x * x)
}
