import { mean } from '../location'

/**
 * Calculates the [sample covariance]{@link https://en.wikipedia.org/wiki/Covariance#Calculating_the_sample_covariance}
 * for paired arrays of values.
 *
 * @method covariance
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {number} The sample covariance, or NaN if either array has fewer than 2 elements. Throws if arrays have
 * different lengths.
 * @example
 *
 * ran.dependence.covariance([], [])
 * // => NaN
 *
 * ran.dependence.covariance([1], [2])
 * // => NaN
 *
 * ran.dependence.covariance([1, 2, 3], [4, 5, 6])
 * // => 1
 *
 * ran.dependence.covariance([1, 9, 10], [1, 2, 10])
 * // => 16.166666666666668
 */
export default function (x, y) {
  // Length mismatch = caller error (throw); degenerate input = indeterminate (NaN). See solutions/correctness/2026-05-31-1200-adr0015-la-stats-undefined-sentinel-audit.md
  if (x.length !== y.length) {
    throw Error('Arrays must have the same length')
  }
  if (x.length < 2) {
    return NaN
  }

  const mx = mean(x)
  const my = mean(y)
  return x.length * mean(x.map((d, i) => (d - mx) * (y[i] - my))) / (x.length - 1)
}
