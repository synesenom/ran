/**
 * Calculates the [mean absolute difference]{@link https://en.wikipedia.org/wiki/Mean_absolute_difference} of an array
 * of values.
 *
 * @method md
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate mean absolute difference for.
 * @returns {number} Mean absolute difference, or NaN for fewer than 2 elements.
 * @example
 *
 * ran.dispersion.md([])
 * // => NaN
 *
 * ran.dispersion.md([1])
 * // => NaN
 *
 * ran.dispersion.md([1, 2, 3, 4])
 * // => 1.25
 */
export default function (values) {
  if (values.length < 2) {
    return NaN
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
