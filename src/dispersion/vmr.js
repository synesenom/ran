import variance from './variance'
import mean from '../location/mean'

/**
 * Calculates the [variance-to-mean ratio]{@link https://en.wikipedia.org/wiki/Index_of_dispersion} of an array
 * of values.
 *
 * @method vmr
 * @memberOf ran.dispersion
 * @param {number[]} values Array of values to calculate variance-to-mean ratio for.
 * @returns {(number|undefined)} Variance-to-mean ratio of the values if there are more than two and the mean is not
 * zero, undefined otherwise.
 * @example
 *
 * ran.dispersion.vmr([])
 * // => undefined
 *
 * ran.dispersion.vmr([1])
 * // => undefined
 *
 * ran.dispersion.vmr([-1, 0, 1])
 * // => undefined
 *
 * ran.dispersion.vmr([1, 2, 3, 4, 5])
 * // => 0.8333333333333334
 */
export default function (values) {
  const v = variance(values)
  const m = mean(values)
  return m === 0 ? undefined : v && v / m
}
