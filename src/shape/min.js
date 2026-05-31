/**
 * Returns the minimum of an array of values.
 *
 * @method min
 * @memberof ran.shape
 * @param {number[]} values Array of values to find the minimum for.
 * @returns {number} The minimum of the values, or NaN for an empty array.
 * @example
 *
 * ran.shape.min([])
 * // => NaN
 *
 * ran.shape.min([3, 1, 4, 1, 5, 9])
 * // => 1
 */
export default function (values) {
  if (values.length === 0) {
    return NaN
  }
  let min = values[0]
  for (const x of values) {
    min = Math.min(x, min)
  }
  return min
}
