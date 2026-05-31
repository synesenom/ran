import stdev from '../dispersion/stdev'
import mean from '../location/mean'

/**
 * Calculates the [point-biserial correlation coefficient]{@link https://en.wikipedia.org/wiki/Point-biserial_correlation_coefficient}
 * for paired arrays of values.
 *
 * @method pointBiserial
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values. Must contain 0s and 1s only.
 * @returns {number} The point-biserial correlation coefficient, or NaN if arrays have fewer than 2 elements or
 * zero variance. Throws if arrays have different lengths.
 * @example
 *
 * ran.dependence.pointBiserial([], [])
 * // => NaN
 *
 * ran.dependence.pointBiserial([2, 2, 2], [0, 0, 1])
 * // => NaN
 *
 * ran.dependence.pointBiserial([1, 2, 3], [4, 5, 6])
 * // => 0.8660254037844386
 */
export default function (x, y) {
  if (x.length !== y.length) {
    throw Error('Arrays must have the same length')
  }
  if (x.length < 2) {
    return NaN
  }

  const s = stdev(x)
  if (s === 0) {
    return NaN
  }

  const x0 = x.filter((d, i) => y[i] === 0)
  const x1 = x.filter((d, i) => y[i] === 1)
  const n0 = x0.length
  const n1 = x1.length
  const m0 = mean(x0)
  const m1 = mean(x1)
  return (m1 - m0) * Math.sqrt(n0 * n1 / (x.length * (x.length - 1))) / s
}
