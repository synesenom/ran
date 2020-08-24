import distanceMatrix from '../utils/distance-matrix'
import mean from '../location/mean'

/**
 * Calculates the [distance variance]{@link https://en.wikipedia.org/wiki/Distance_correlation#Distance_variance} for
 * paired arrays of values.
 *
 * @method dVar
 * @methodOf ran.dependence
 * @param {number[]} x Array of values.
 * @returns {(number|undefined)} The distance variance if the array os not empty, undefined otherwise.
 * @example
 *
 * ran.dependence.dVar([])
 * // => undefined
 *
 * ran.dependence.dVar([1, 2, 3])
 * // => 0.7027283689263066
 */
export default function (x) {
  if (x.length === 0) {
    return undefined
  }

  // Calculate distance matrix.
  const a = distanceMatrix(x)
  return Math.sqrt(mean([].concat(...a.hadamard(a).m())))
}
