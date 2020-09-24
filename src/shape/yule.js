import quantile from './quantile'
import median from '../location/median'

/**
 * Calculates [Yule's coefficient]{@link https://en.wikipedia.org/wiki/Skewness#Quantile-based_measures} which is a
 * measure of skewness based on quantiles.
 *
 * @method yule
 * @memberof ran.shape
 * @param {number[]} values Array of values to calculate Yule's coefficient for.
 * @returns {(number|undefined)} Yule's coefficient of the values if the lower and upper quartiles differ, undefined
 * otherwise.
 * @example
 *
 * ran.shape.yule([])
 * // => undefined
 *
 * ran.shape.yule([1, 1, 1])
 * // => undefined
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

  return q1 === q3 ? undefined : (q1 + q3 - 2 * median(values)) / (q3 - q1)
}
