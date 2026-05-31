import distanceMatrix from '../utils/distance-matrix'
import mean from '../location/mean'

/**
 * Calculates the [distance correlation]{@link https://en.wikipedia.org/wiki/Distance_correlation#Distance_correlation}
 * for paired arrays of values.
 *
 * @method dCor
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {number} The distance correlation, or NaN for empty or constant arrays. Throws if arrays have different
 * lengths.
 * @example
 *
 * ran.dependence.dCor([], [])
 * // => NaN
 *
 * ran.dependence.dCor([1, 2, 3], [2, 1, 2])
 * // => 0.5623413251903491
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
  const dVarX = Math.sqrt(mean([].concat(...a.hadamard(a).m())))
  const dVarY = Math.sqrt(mean([].concat(...b.hadamard(b).m())))
  if (dVarX * dVarY > 0) {
    const dCov = Math.sqrt(mean([].concat(...a.hadamard(b).m())))
    return dCov / Math.sqrt(dVarX * dVarY)
  }
  return NaN
}
