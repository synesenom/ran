import { introselect } from '../algorithms'

/**
 * Calculates the median of a sample of values.
 *
 * @method median
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate median for.
 * @returns {number} Median of the values, NaN for empty input.
 * @example
 *
 * ran.location.median([])
 * // => NaN
 *
 * ran.location.median([1, 2, 3, 4])
 * // => 2.5
 */
export default function (values) {
  if (values.length === 0) {
    return NaN
  }

  const n = values.length
  if (n % 2 === 1) {
    return introselect(values, (n - 1) / 2)
  } else {
    return 0.5 * (introselect(values, n / 2 - 1) + introselect(values, n / 2))
  }
}
