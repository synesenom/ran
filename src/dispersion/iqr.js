import quantile from '../shape/quantile'

/**
 * Calculates the [interquartile range]{@link https://en.wikipedia.org/wiki/Interquartile_range} for a sample of values.
 *
 * @method iqr
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate the interquartile range for.
 * @returns {number} The interquartile range, or NaN for an empty array.
 * @example
 *
 * ran.dispersion.iqr([])
 * // => NaN
 *
 * ran.dispersion.iqr([1, 1, 2, 3, 3])
 * // => 2
 */
export default function (values) {
  if (values.length === 0) {
    return NaN
  }

  return quantile(values, 0.75) - quantile(values, 0.25)
}
