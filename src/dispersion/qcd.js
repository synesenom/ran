import quantile from '../shape/quantile'

/**
 * Calculates the [quartile coefficient of dispersion]{@link https://en.wikipedia.org/wiki/Quartile_coefficient_of_dispersion}
 * for a sample of values.
 *
 * @method qcd
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate quartile coefficient of dispersion for.
 * @returns {number} The quartile coefficient of dispersion, or NaN for an empty array.
 * @example
 *
 * ran.dispersion.qcd([])
 * // => NaN
 *
 * ran.dispersion.qcd([1, 2, 3])
 * // => 0.25
 */
export default function (values) {
  if (values.length === 0) {
    return NaN
  }

  const q1 = quantile(values, 0.25)
  const q3 = quantile(values, 0.75)
  return (q3 - q1) / (q1 + q3)
}
