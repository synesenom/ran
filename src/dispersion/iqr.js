import quantile from '../utils/quantile'

/**
 * Calculates the [interquartile range]{@link https://en.wikipedia.org/wiki/Interquartile_range} for a sample of values.
 *
 * @method iqr
 * @methodOf ran.dispersion
 * @param {number[]} values Array of values to calculate the interquartile range for.
 * @return {(number|undefined)} The interquartile range of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.dispersion.iqr([])
 * // => undefined
 *
 * ran.dispersion.iqr([1, 1, 2, 3, 3])
 * // => 2
 */
export default function (values) {
  if (values.length === 0) {
    return undefined
  }

  return quantile(values, 0.75) - quantile(values, 0.25)
}
