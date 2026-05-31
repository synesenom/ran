import quantile from '../shape/quantile'

/**
 * Calculates the [midhinge]{@link https://en.wikipedia.org/wiki/Midhinge} for a sample of values.
 *
 * @method midhinge
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate midhinge for.
 * @returns {number} The midhinge, or NaN for an empty array.
 * @example
 *
 * ran.dispersion.midhinge([])
 * // => NaN
 *
 * ran.dispersion.midhinge([1, 1, 1, 2, 3])
 * // => 1.5
 */
export default function (values) {
  if (values.length === 0) {
    return NaN
  }

  return (quantile(values, 0.25) + quantile(values, 0.75)) / 2
}
