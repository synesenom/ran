/**
 * Calculates the mean of an array of values.
 *
 * @method mean
 * @memberOf ran.utils
 * @param {number[]} values Array of values to calculate mean for.
 * @returns {(number|undefined)} Mean of the values if there are any, undefined otherwise.
 * @private
 */
export default function (values) {
  return values.length > 0 ? values.reduce((acc, d) => acc + d, 0) / values.length : undefined
}
