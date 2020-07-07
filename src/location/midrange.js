/**
 * Calculates the [mid-range]{@link https://en.wikipedia.org/wiki/Mid-range} for a sample of values.
 *
 * @method midrange
 * @methodOf ran.location
 * @param {number[]} values Array of values to calculate mid-range for.
 * @return {(number|undefined)} The mid-range of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.location.midrange([])
 * // => undefined
 *
 * ran.location.midrange([0, 0, 0, 1, 2])
 * // => 1
 */
export default function (values) {
  if (values.length === 0) {
    return undefined
  }

  let min = values[0]
  let max = values[0]
  for (let x of values) {
    min = Math.min(min, x)
    max = Math.max(max, x)
  }
  return (min + max) / 2
}
