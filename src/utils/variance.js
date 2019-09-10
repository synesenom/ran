import mean from './mean'

/**
 * Calculates the variance of an array of values.
 *
 * @method variance
 * @memberOf ran.utils
 * @param {number[]} values Array of values to calculate variance for.
 * @returns {(number|undefined)} Variance of the values if there are any, undefined otherwise.
 * @private
 */
export default function (values) {
  if (values.length === 0) {
    return undefined
  } else {
    const m = mean(values)
    const m2 = values.reduce((acc, d) => acc + d * d, 0)
    return m2 / values.length - m * m
  }
}
