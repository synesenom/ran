import md from './md'
import mean from '../location/mean'

/**
 * Calculates the [relative mean absolute difference]{@link https://en.wikipedia.org/wiki/Mean_absolute_difference#Relative_mean_absolute_difference} of an array of values.
 *
 * @method rmd
 * @methodOf ran.dispersion
 * @param {number[]} values Array of values to calculate relative mean absolute difference for.
 * @returns {(number|undefined)} Relative mean absolute difference of the values if there are more than two, undefined
 * otherwise.
 * @example
 *
 * ran.dispersion.rmd([])
 * // => undefined
 *
 * ran.dispersion.rmd([1])
 * // => undefined
 *
 * ran.dispersion.rmd([-1, 0, 1])
 * // => undefined
 *
 * ran.dispersion.rmd([1, 2, 3, 4])
 * // => 0.5
 */
export default function (values) {
  if (values.length < 2) {
    return undefined
  }

  const m = mean(values)
  return m === 0 ? undefined : md(values) / m
}
