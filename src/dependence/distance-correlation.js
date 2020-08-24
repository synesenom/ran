import distanceMatrix from '../utils/distance-matrix'
import mean from '../location/mean'

/**
 * Calculates the [distance correlation]{@link https://en.wikipedia.org/wiki/Distance_correlation#Distance_correlation}
 * for paired arrays of values.
 *
 * @method dCor
 * @methodOf ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} The distance correlation if none of the arrays are empty and they have the same length,
 * undefined otherwise.
 * @example
 *
 * ran.dependence.dCor([1, 2, 3], [])
 * // => undefined
 *
 * ran.dependence.dCor([1, 2, 3], [2, 1, 2])
 * // => 0.5623413251903491
 */
export default function (x, y) {
  const a = distanceMatrix(x)
  const b = distanceMatrix(y)
  const dVarX = Math.sqrt(mean([].concat(...a.hadamard(a).m())))
  const dVarY = Math.sqrt(mean([].concat(...b.hadamard(b).m())))
  const dCov = Math.sqrt(mean([].concat(...a.hadamard(b).m())))
  return dVarX * dVarY > 0 ? dCov / Math.sqrt(dVarX * dVarY) : undefined
}
