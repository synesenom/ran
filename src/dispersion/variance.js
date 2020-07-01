/**
 * Calculates the unbiased sample variance of an array of values using [Welford's algorithm]{@link https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm}.
 *
 * @method variance
 * @memberOf ran.dispersion
 * @param {number[]} values Array of values to calculate variance for.
 * @returns {(number|undefined)} Variance of the values if there are more than two, undefined otherwise.
 * @example
 *
 * ran.dispersion.variance([])
 * // => undefined
 *
 * ran.dispersion.variance([1])
 * // => undefined
 *
 * ran.dispersion.variance([1, 2, 3])
 * // => 2.5
 */
export default function (values) {
  if (values.length > 1) {
    let n = 0
    let diff = 0
    let mean = 0
    let M = 0
    for (const x of values) {
      diff = x - mean
      mean += diff / ++n
      M += diff * (x - mean)
    }
    return M / (n - 1)
  }
}
