/**
 * Returns the minimum of an array of values.
 *
 * @method min
 * @memberof ran.shape
 * @param {number[]} values Array of values to find the minimum for.
 * @returns {number} The minimum of the values.
 */
export default function (values) {
  let min = values[0]
  for (const x of values) {
    min = Math.min(x, min)
  }
  return min
}
