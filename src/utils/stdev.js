import variance from './variance'

/**
 * Calculates the standard deviation of an array of values.
 *
 * @method stdev
 * @memberOf ran.utils
 * @param {number[]} values Array of values to calculate standard deviation for.
 * @returns {(number|undefined)} Standard deviation of the values if there are any, undefined otherwise.
 * @private
 */
export default function (values) {
  return values.length > 0 ? Math.abs(Math.sqrt(variance(values))) : undefined
}
