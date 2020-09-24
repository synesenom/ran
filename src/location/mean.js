/**
 * Calculates the [arithmetic mean]{@link https://en.wikipedia.org/wiki/Arithmetic_mean} of an array of values.
 *
 * @method mean
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate mean for.
 * @returns {(number|undefined)} Mean of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.location.mean([])
 * // => undefined
 *
 * ran.location.mean([1, 2, 3])
 * // => 2
 */
export default function (values) {
  return values.length > 0 ? values.reduce((acc, d) => acc + d, 0) / values.length : undefined
}
