import quantile from '../shape/quantile'

/**
 * Calculates the [quartile coefficient of dispersion]{@link https://en.wikipedia.org/wiki/Quartile_coefficient_of_dispersion}
 * for a sample of values.
 *
 * @method qcd
 * @methodOf ran.dispersion
 * @param {number[]} values Array of values to calculate quartile coefficient of dispersion for.
 * @return {(number|undefined)} The quartile coefficient of dispersion of the values if there is any, undefined
 * otherwise.
 * @example
 *
 * ran.dispersion.qcd([])
 * // => undefined
 *
 * ran.dispersion.qcd([1, 2, 3])
 * // => 0.25
 */
export default function (values) {
  if (values.length === 0) {
    return undefined
  }

  const q1 = quantile(values, 0.25)
  const q3 = quantile(values, 0.75)
  return (q3 - q1) / (q1 + q3)
}
