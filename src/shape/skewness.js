import mean from '../location/mean'

/**
 * Calculates the [Fisher-Pearson standardized sample skewness]{@link https://en.wikipedia.org/wiki/Skewness#Sample_skewness}
 * for a sample of values.
 *
 * @method skewness
 * @methodOf ran.shape
 * @param {number[]} values Array of values to calculate skewness for.
 * @returns {(number|undefined)} The sample skewness of values if there are more than two and their variance is nonzero,
 * undefined otherwise.
 * @example
 *
 * ran.shape.skewness([])
 * // => undefined
 *
 * ran.shape.skewness([1, 2])
 * // => undefined
 *
 * ran.shape.skewness([1, 1, 1])
 * // => undefined
 *
 * ran.shape.skewness([1, 1, 1, 2])
 * // => 2
 *
 * ran.shape.skewness([1, 2, 2, 2])
 * // => -2
 */
export default function (values) {
  if (values.length < 3) {
    return undefined
  }

  const n = values.length
  const m = mean(values)
  const m2 = mean(values.map(d => Math.pow(d - m, 2)))
  const m3 = mean(values.map(d => Math.pow(d - m, 3)))
  return m2 === 0 ? undefined : Math.sqrt(n * (n - 1)) * m3 / ((n - 2) * Math.pow(m2, 1.5))
}
