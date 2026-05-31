import rank from '../shape/rank'
import pearson from './pearson'

/**
 * Calculates [Spearman's rank correlation coefficient]{@link https://en.wikipedia.org/wiki/Spearman%27s_rank_correlation_coefficient}
 * for two paired arrays of values.
 *
 * @method spearman
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {number} Spearman's rank correlation coefficient, or NaN for empty arrays. Throws if arrays have
 * different lengths.
 * @example
 *
 * ran.dependence.spearman([], [])
 * // => NaN
 *
 * ran.dependence.spearman([1, 2, 3], [1, 4, 2])
 * // => 0.5
 *
 * ran.dependence.spearman([1, 9, 10], [1, 2, 10])
 * // => 1
 */
export default function (x, y) {
  if (x.length !== y.length) {
    throw Error('Arrays must have the same length')
  }
  if (x.length === 0) {
    return NaN
  }

  return pearson(rank(x), rank(y))
}
