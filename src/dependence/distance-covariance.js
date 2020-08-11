import mean from '../location/mean'
import distanceMatrix from '../utils/distance-matrix'

/**
 * Calculates the [distance covariance]{@link https://en.wikipedia.org/wiki/Distance_correlation#Distance_covariance} for
 * paired arrays of values.
 *
 * @method dCov
 * @methodOf ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} The distance covariance if none of the arrays are empty and they have the same length,
 * undefined otherwise.
 * @example
 *
 * ran.dependence.dCov([1, 2, 3], [])
 * // => undefined
 *
 * ran.dependence.dCov([1, 2, 3], [2, 1, 2])
 * // => 0.31426968052735443
 */
export default function (x, y) {
  if (x.length * y.length === 0 || x.length !== y.length) {
    return undefined
  }

  const a = distanceMatrix(x)
  const b = distanceMatrix(y)
  return Math.sqrt(mean(a.hadamard(b).m().flat()))
}
