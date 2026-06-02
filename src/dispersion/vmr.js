import variance from './variance'
import mean from '../location/mean'

/**
 * Calculates the [variance-to-mean ratio]{@link https://en.wikipedia.org/wiki/Index_of_dispersion} of an array
 * of values.
 *
 * @method vmr
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate variance-to-mean ratio for.
 * @returns {number} Variance-to-mean ratio, or NaN for fewer than 2 elements or zero mean.
 * @example
 *
 * ran.dispersion.vmr([])
 * // => NaN
 *
 * ran.dispersion.vmr([1])
 * // => NaN
 *
 * ran.dispersion.vmr([-1, 0, 1])
 * // => NaN
 *
 * ran.dispersion.vmr([1, 2, 3, 4, 5])
 * // => 0.8333333333333334
 */
export default function (values) {
  const v = variance(values)
  const m = mean(values)
  return m === 0 ? NaN : v && v / m
}
