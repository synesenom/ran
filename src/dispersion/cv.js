import stdev from './stdev'
import mean from '../location/mean'

/**
 * Calculates the [coefficient of variation]{@link https://en.wikipedia.org/wiki/Coefficient_of_variation} of an array
 * of values.
 *
 * @method cv
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate coefficient of variation for.
 * @returns {number} Coefficient of variation, or NaN for fewer than 2 elements, zero mean, or zero variance.
 * @example
 *
 * ran.dispersion.cv([])
 * // => NaN
 *
 * ran.dispersion.cv([1])
 * // => NaN
 *
 * ran.dispersion.cv([-1, 0, 1])
 * // => NaN
 *
 * ran.dispersion.cv([1, 2, 3, 4, 5])
 * // => 0.5270462766947299
 */
export default function (values) {
  const s = stdev(values)
  const m = mean(values)
  return m === 0 ? NaN : s && s / m
}
