import sign from '../utils/sign'

function nTies (values) {
  const counts = values.reduce((acc, d) => Object.assign(acc, {[d]: (acc[d] || 0) + 1}), {})
  const ties = Object.values(counts).filter(d => d > 1)
  return ties.reduce((sum, d) => sum + d * (d - 1) / 2, 0)
}

/**
 * Calculates [Kendall's (type B) correlation coefficient]{@link https://en.wikipedia.org/wiki/Pearson_correlation_coefficient}
 * for paired arrays of values.
 *
 * @method kendall
 * @methodOf ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} Kendall's correlation coefficient if none of the arrays are empty and they have the
 * same length, undefined otherwise.
 * @example
 *
 * ran.dependence.kendall([], [])
 * // => undefined
 *
 * ran.dependence.kendall([1, 2, 3], [1, 2, 3, 4])
 * // => undefined
 *
 * ran.dependence.kendall([1, 2, 3], [4, 5, 6])
 * // => 1
 *
 * ran.dependence.kendall([1, 2, 3], [1, 4, 2])
 * // => 0.3333333333333333
 */
export default function (x, y) {
  if (x.length === 0 || y.length === 0 || x.length !== y.length) {
    return undefined
  }

  // Numerator.
  let num = 0
  for (let i = 1; i < x.length; i++) {
    for (let j = 0; j < i; j++) {
      num += sign(x[i] - x[j]) * sign(y[i] - y[j])
    }
  }

  // Correction for ties.
  const n0 = x.length * (x.length - 1) / 2
  const n1 = nTies(x)
  const n2 = nTies(y)

  // Return the final value.
  return num / Math.sqrt((n0 - n1) * (n0 - n2))
}
