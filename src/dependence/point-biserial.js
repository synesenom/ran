import stdev from '../dispersion/stdev'
import mean from '../location/mean'

/**
 * Calculates the [point-biserial correlation coefficient]{@link https://en.wikipedia.org/wiki/Point-biserial_correlation_coefficient}
 * for paired arrays of values.
 *
 * @method pointBiserial
 * @methodOf ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values. Must contain 0s and 1s only.
 * @returns {(number|undefined)} The point-biserial correlation coefficient if none of the arrays are empty, they have
 * the same length and each has a positive variance, undefined otherwise.
 * @example
 *
 * ran.dependence.pointBiserial([], [])
 * // => undefined
 *
 * ran.dependence.pointBiserial([1, 2, 3], [0, 0, 1, 1])
 * // => undefined
 *
 * ran.dependence.pointBiserial([2, 2, 2], [0, 0, 1])
 * // => undefined
 *
 * ran.dependence.pointBiserial([1, 2, 3], [4, 5, 6])
 * // => 0.8660254037844386
 */
export default function (x, y) {
  if (x.length === 0 || y.length === 0 || x.length !== y.length) {
    return undefined
  }

  const s = stdev(x)
  if (s === 0) {
    return undefined
  }

  const x0 = x.filter((d, i) => y[i] === 0)
  const x1 = x.filter((d, i) => y[i] === 1)
  const n0 = x0.length
  const n1 = x1.length
  const m0 = mean(x0)
  const m1 = mean(x1)
  return (m1 - m0) * Math.sqrt(n0 * n1 / (x.length * (x.length - 1))) / s
}
