import quantile from '../shape/quantile'

/**
 * Calculates the [midhinge]{@link https://en.wikipedia.org/wiki/Midhinge} for a sample of values.
 *
 * @method midhinge
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate midhinge for.
 * @returns {(number|undefined)} The midhinge of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.dispersion.midhinge([])
 * // => undefined
 *
 * ran.dispersion.midhinge([1, 1, 1, 2, 3])
 * // => 1.5
 */
export default function (values) {
  if (values.length === 0) {
    return undefined
  }

  return (quantile(values, 0.25) + quantile(values, 0.75)) / 2
}
