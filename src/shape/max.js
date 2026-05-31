/**
 * Returns the maximum of an array of values.
 *
 * @method max
 * @memberof ran.shape
 * @param {number[]} values Array of values to find the maximum for.
 * @returns {number} The maximum of the values.
 */
export default function (values) {
  if (values.length === 0) {
    return NaN
  }
  let max = values[0]
  for (const x of values) {
    max = Math.max(x, max)
  }
  return max
}
