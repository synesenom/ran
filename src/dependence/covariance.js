import { mean } from '../location'

/**
 * Calculates the [sample covariance]{@link https://en.wikipedia.org/wiki/Covariance#Calculating_the_sample_covariance}
 * for paired arrays of values.
 *
 * @method covariance
 * @methodOf ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} The sample covariance if both arrays have more than one element and they have the same
 * length, undefined otherwise.
 * @example
 *
 * ran.dependence.covariance([], [])
 * // => undefined
 *
 * ran.dependence.covariance([1], [2])
 * // => undefined
 *
 * ran.dependence.covariance([1, 2, 3], [1, 2, 3, 4])
 * // => undefined
 *
 * ran.dependence.covariance([1, 2, 3], [4, 5, 6])
 * // => 1
 *
 * ran.dependence.covariance([1, 9, 10], [1, 2, 10])
 * // => 16.166666666666668
 */
export default function (x, y) {
  // TODO Make this a separate utility method.
  if (x.length < 2 || y.length < 2 || x.length !== y.length) {
    return undefined
  }

  const mx = mean(x)
  const my = mean(y)
  return x.length * mean(x.map((d, i) => (d - mx) * (y[i] - my))) / (x.length - 1)
}
