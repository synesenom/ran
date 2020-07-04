/**
 * Calculates the mean absolute difference of an array of values.
 *
 * @method md
 * @methodOf ran.dispersion
 * @param {number[]} values Array of values to calculate mean absolute difference for.
 * @returns {(number|undefined)} Standard deviation of the values if there are more than two, undefined otherwise.
 * @example
 *
 * ran.dispersion.md([])
 * // => undefined
 *
 * ran.dispersion.md([1])
 * // => undefined
 *
 * ran.dispersion.md([1, 2, 3, 4])
 * // => 1.25
 */
export default function (values) {
  if (values.length < 2) {
    return undefined
  }

  let sum = 0
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values.length; j++) {
      if (j > i) {
        sum += Math.abs(values[i] - values[j])
      }
    }
  }
  return 2 * sum / (values.length * values.length)
}
