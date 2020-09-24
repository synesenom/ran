import mean from './mean'

/**
 * Calculates the [geometric mean]{@link https://en.wikipedia.org/wiki/Geometric_mean} of an array of values.
 *
 * @method geometricMean
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate geometric mean for.
 * @returns {(number|undefined)} Gemoetric mean of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.location.geometricMean([])
 * // => undefined
 *
 * ran.location.geometricMean([1, 2, 3])
 * // => 1.8171205928321394
 */
export default function (values) {
  // Check if sample contains zeroes.
  if (values.reduce((acc, d) => acc || d === 0, false)) {
    return 0
  }

  return Math.exp(mean(values.map(d => Math.log(Math.abs(d)))))
}
