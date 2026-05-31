import quantile from './quantile'
import median from '../location/median'

/**
 * Calculates [Yule's coefficient]{@link https://en.wikipedia.org/wiki/Skewness#Quantile-based_measures} which is a
 * measure of skewness based on quantiles.
 *
 * @method yule
 * @memberof ran.shape
 * @param {number[]} values Array of values to calculate Yule's coefficient for.
 * @returns {number} Yule's coefficient, or NaN for an empty array or when the lower and upper quartiles are equal.
 * @example
 *
 * ran.shape.yule([])
 * // => NaN
 *
 * ran.shape.yule([1, 1, 1])
 * // => NaN
 *
 * ran.shape.yule([1, 1, 1, 2])
 * // => 1
 *
 * ran.shape.yule([1, 2, 2, 2])
 * // => -1
 */
export default function (values) {
  const q1 = quantile(values, 0.25)
  const q3 = quantile(values, 0.75)

  return q1 === q3 ? NaN : (q1 + q3 - 2 * median(values)) / (q3 - q1)
}
