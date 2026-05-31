/**
 * Calculates the [mid-range]{@link https://en.wikipedia.org/wiki/Mid-range} for a sample of values.
 *
 * @method midrange
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate mid-range for.
 * @returns {number} The mid-range of the values, NaN for empty input.
 * @example
 *
 * ran.location.midrange([])
 * // => NaN
 *
 * ran.location.midrange([0, 0, 0, 1, 2])
 * // => 1
 */
export default function (values) {
  if (values.length === 0) {
    return NaN
  }

  let min = values[0]
  let max = values[0]
  for (const x of values) {
    min = Math.min(min, x)
    max = Math.max(max, x)
  }
  return (min + max) / 2
}
