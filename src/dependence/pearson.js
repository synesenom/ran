import stdev from '../dispersion/stdev'
import covariance from './covariance'

/**
 * Calculates the [Pearson correlation coefficient]{@link https://en.wikipedia.org/wiki/Pearson_correlation_coefficient}
 * for paired arrays of values.
 *
 * @method pearson
 * @methodOf ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} The Pearson correlation coefficient if none of the arrays are empty, they have the
 * same length and each has a positive variance, undefined otherwise.
 * @example
 *
 * ran.dependence.pearson([], [])
 * // => undefined
 *
 * ran.dependence.pearson([1, 2, 3], [1, 2, 3, 4])
 * // => undefined
 *
 * ran.dependence.pearson([1, 2, 3], [1, 1, 1])
 * // => undefined
 *
 * ran.dependence.pearson([1, 2, 3], [4, 5, 6])
 * // => 1
 *
 * ran.dependence.pearson([1, 9, 10], [1, 2, 10])
 * // => 0.6643835616438358
 */
export default function (x, y) {
  // TODO Check if length is below 2.
  const cov = covariance(x, y)
  const sx = stdev(x)
  const sy = stdev(y)
  return typeof cov === 'undefined' || sx * sy === 0 ? undefined : cov / (sx * sy)
}
