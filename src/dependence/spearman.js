import rank from '../shape/rank'
import pearson from './pearson'

/**
 * Calculates [Spearman's rank correlation coefficient]{@link https://en.wikipedia.org/wiki/Spearman%27s_rank_correlation_coefficient}
 * for two paired arrays of values.
 *
 * @method spearman
 * @methodOf ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} Spearman's rank correlation coefficient if none of the arrays are empty and they have
 * the same length, undefined otherwise.
 * @example
 *
 * ran.dependence.spearman([], [])
 * // => undefined
 *
 * ran.dependence.spearman([1, 2, 3], [1, 2, 3, 4])
 * // => undefined
 *
 * ran.dependence.spearman([1, 2, 3], [1, 4, 2])
 * // => 0.5
 *
 * ran.dependence.spearman([1, 9, 10], [1, 2, 10])
 * // => 1
 */
export default function (x, y) {
  if (x.length === 0 || y.length === 0 || x.length !== y.length) {
    return undefined
  }

  return pearson(rank(x), rank(y))
}
