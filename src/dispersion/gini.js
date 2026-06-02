import rmd from './rmd'

/**
 * Calculates the [Gini coefficient]{@link https://en.wikipedia.org/wiki/Gini_coefficient} for a sample of values.
 *
 * @method gini
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate the Gini coefficient for.
 * @returns {number} The Gini coefficient, or NaN for fewer than 2 elements or zero mean.
 * @example
 *
 * ran.dispersion.gini([])
 * // => NaN
 *
 * ran.dispersion.gini([1])
 * // => NaN
 *
 * ran.dispersion.gini([-1, 0, 1])
 * // => NaN
 *
 * ran.dispersion.gini([1, 2, 3, 4])
 * // => 0.25
 *
 * ran.dispersion.gini([1, 1, 1, 7])
 * // => 0.45
 */
export default function (values) {
  const r = rmd(values)
  return r && r / 2
}
