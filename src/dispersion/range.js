/**
 * Calculates the [range]{@link } for a sample of values.
 *
 * @method range
 * @methodOf ran.dispersion
 * @param {number[]} values Array of values to calculate range for.
 * @return {(number|undefined)} The range of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.dispersion.range([])
 * // => undefined
 *
 * ran.dispersion.range([0, 1, 2, 2])
 * // => 2
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
  return max - min
}
