import mean from '../location/mean'
import distanceMatrix from '../utils/distance-matrix'

/**
 * Calculates the [distance covariance]{@link https://en.wikipedia.org/wiki/Distance_correlation#Distance_covariance} for
 * paired arrays of values.
 *
 * @method dCov
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {number} The distance covariance, or NaN for empty arrays. Throws if arrays have different lengths.
 * @example
 *
 * ran.dependence.dCov([], [])
 * // => NaN
 *
 * ran.dependence.dCov([1, 2, 3], [2, 1, 2])
 * // => 0.31426968052735443
 */
export default function (x, y) {
  if (x.length !== y.length) {
    throw Error('Arrays must have the same length')
  }
  if (x.length === 0) {
    return NaN
  }

  const a = distanceMatrix(x)
  const b = distanceMatrix(y)
  return Math.sqrt(mean([].concat(...a.hadamard(b).m())))
}
