import variance from './variance'

/**
 * Calculates the unbiased standard deviation of an array of values.
 *
 * @method stdev
 * @memberOf ran.dispersion
 * @param {number[]} values Array of values to calculate standard deviation for.
 * @returns {(number|undefined)} Standard deviation of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.dispersion.stdev([])
 * // => undefined
 *
 * ran.dispersion.stdev([1])
 * // => undefined
 *
 * ran.dispersion.stdev([1, 2, 3, 4, 5])
 * // => 1.5811388300841898
 */
// TODO Example.
export default function (values) {
  return values.length > 1 ? Math.abs(Math.sqrt(variance(values))) : undefined
}
