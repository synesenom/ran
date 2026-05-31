import quantile from '../shape/quantile'
import median from './median'

/**
 * Calculates the [trimean]{@link https://en.wikipedia.org/wiki/Trimean} for a sample of values.
 *
 * @method trimean
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate trimean for.
 * @returns {number} The trimean of the values, NaN for empty input.
 * @example
 *
 * ran.location.trimean([])
 * // => NaN
 *
 * ran.location.trimean([1, 1, 1, 2, 3])
 * // => 1.25
 */
export default function (values) {
  if (values.length === 0) {
    return NaN
  }

  return (quantile(values, 0.25) + 2 * median(values) + quantile(values, 0.75)) / 4
}
