import mean from '../location/mean'

/**
 * Calculates the [k-th raw moment]{@link https://en.wikipedia.org/wiki/Moment_(mathematics)} for a sample of values.
 *
 * @method moment
 * @methodOf ran.shape
 * @param {number[]} values Array of values to calculate moment for.
 * @param {number} k Order of the moment.
 * @param {number} [c = 0] Value to shift the distribution by before calculating the moment.
 * @return {(number|undefined)} The k-th moment of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.shape.moment([], 2)
 * // => undefined
 *
 * ran.shape.moment([1, 2, 3], 0)
 * // => 1
 *
 * ran.shape.moment([1, 2, 3], 2)
 * // => 4.666666666666667
 */
export default function (values, k, c = 0) {
  return values.length > 0 ? mean(values.map(d => Math.pow(d - c, k))) : undefined
}
