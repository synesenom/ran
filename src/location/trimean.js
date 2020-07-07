import quantile from '../utils/quantile'
import median from './median'

/**
 * Calculates the [trimean]{@link https://en.wikipedia.org/wiki/Trimean} for a sample of values.
 *
 * @method trimean
 * @methodOf ran.location
 * @param {number[]} values Array of values to calculate trimean for.
 * @return {(number|undefined)} The trimean of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.location.trimean([])
 * // => undefined
 *
 * ran.location.trimean([1, 1, 1, 2, 3])
 * // => 1.25
 */
export default function (values) {
  if (values.length === 0) {
    return undefined
  }

  return (quantile(values, 0.25) + 2 * median(values) + quantile(values, 0.75)) / 4
}
