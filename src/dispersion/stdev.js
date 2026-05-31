import variance from './variance'

/**
 * Calculates the unbiased standard deviation of an array of values.
 *
 * @method stdev
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate standard deviation for.
 * @returns {number} Standard deviation of the values, NaN for fewer than 2 elements.
 * @example
 *
 * ran.dispersion.stdev([])
 * // => NaN
 *
 * ran.dispersion.stdev([1])
 * // => NaN
 *
 * ran.dispersion.stdev([1, 2, 3, 4, 5])
 * // => 1.5811388300841898
 */
export default function (values) {
  // TODO Check for undefined in unit test.
  const v = variance(values)
  return v && Math.abs(Math.sqrt(v))
}
