/* const coeffs = [
  1 / 12,
  1 / 120,
  1 / 252,
  1 / 240,
  1 / 132,
  1 / 12
] */

/**
 * Evaluates the digamma function using the series expanson.
 *
 * @method _psiSeries
 * @memberof ran.special
 * @param {number} z Argument to evaluate digamma for.
 * @returns {number} The estimated value.
 * @private
 */
/* function _psiSeries (z) {
  let z2 = z * z
  let s = 0
  for (let i = coeffs.length - 1; i >= 0; i--) {
    s = (coeffs[i] - s) / z2
  }
  return Math.log(z) - 0.5 / z - s
} */

/**
 * Computes the digamma function for arbitrary arguments.
 * Source: https://www.jstor.org/stable/2347257
 *
 * @method digamma
 * @memberof ran.special
 * @param {number} z Value to evaluate digamma at.
 * @returns {number} The digamma function at the specified value.
 * @private
 */
/* function _digamma (z) {
  // Reflection for z < 0
  if (z < 0) {
    return _digamma(1 - z) - Math.PI / Math.tan(Math.PI * z)
  }

  // Shift z
  let s = 0
  while (z < 10) {
    s = s - 1 / z
    z = z + 1
  }
  return _psiSeries(z) + s
}

export default _digamma */
