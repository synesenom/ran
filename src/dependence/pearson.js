import stdev from '../dispersion/stdev'
import covariance from './covariance'

/**
 * Calculates the [Pearson correlation coefficient]{@link https://en.wikipedia.org/wiki/Pearson_correlation_coefficient}
 * for paired arrays of values.
 *
 * @method pearson
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {number} The Pearson correlation coefficient, or NaN if arrays have fewer than two elements or zero variance.
 * Throws if arrays have different lengths.
 * @example
 *
 * ran.dependence.pearson([], [])
 * // => NaN
 *
 * ran.dependence.pearson([1, 2, 3], [1, 1, 1])
 * // => NaN
 *
 * ran.dependence.pearson([1, 2, 3], [4, 5, 6])
 * // => 1
 *
 * ran.dependence.pearson([1, 9, 10], [1, 2, 10])
 * // => 0.6643835616438358
 */
export default function (x, y) {
  const cov = covariance(x, y)
  const sx = stdev(x)
  const sy = stdev(y)
  return Number.isNaN(cov) || sx * sy === 0 ? NaN : cov / (sx * sy)
}
