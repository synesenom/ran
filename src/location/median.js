import { quickselect } from '../algorithms'

/**
 * Calculates the median of a sample of values.
 *
 * @method median
 * @methodOf ran.location
 * @param {number[]} values Array of values to calculate median for.
 * @return {number} Median of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.location.median([])
 * // => undefined
 *
 * ran.location.median([1, 2, 3, 4])
 * // => 2.5
 */
export default function (values) {
  if (values.length === 0) {
    return undefined
  }

  const n = values.length
  if (n % 2 === 1) {
    return quickselect(values, (n - 1) / 2)
  } else {
    return 0.5 * (quickselect(values, n / 2 - 1) + quickselect(values, n / 2))
  }
}
