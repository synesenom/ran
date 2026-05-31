import md from './md'
import mean from '../location/mean'

/**
 * Calculates the [relative mean absolute difference]{@link https://en.wikipedia.org/wiki/Mean_absolute_difference#Relative_mean_absolute_difference} of an array of values.
 *
 * @method rmd
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate relative mean absolute difference for.
 * @returns {number} Relative mean absolute difference, or NaN for fewer than 2 elements or zero mean.
 * @example
 *
 * ran.dispersion.rmd([])
 * // => NaN
 *
 * ran.dispersion.rmd([1])
 * // => NaN
 *
 * ran.dispersion.rmd([-1, 0, 1])
 * // => NaN
 *
 * ran.dispersion.rmd([1, 2, 3, 4])
 * // => 0.5
 */
export default function (values) {
  const mad = md(values)
  const m = mean(values)
  return m === 0 ? NaN : mad && mad / m
}
