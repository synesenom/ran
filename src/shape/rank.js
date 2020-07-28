/**
 * Calculates the fractional rank for an array of values.
 *
 * @method rank
 * @methodOf ran.shape
 * @param {number[]} values Array of values to calculate ranks for.
 * @returns {(number|undefined)} The ranks of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.shape.rank([])
 * // => undefined
 *
 * ran.shape.rank([1, 2, 2, 3])
 * // => [1, 2.5, 2.5, 4]
 */
export default function (values) {
  if (values.length === 0) {
    return undefined
  }

  const sorted = values.slice().sort((a, b) => a - b)
  const reversed = sorted.slice().reverse()
  return values.map(d => (sorted.indexOf(d) + 1 + reversed.length - reversed.indexOf(d)) / 2)
}
