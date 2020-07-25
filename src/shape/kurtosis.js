import mean from '../location/mean'

/**
 * Calculates the [sample kurtosis]{@link https://en.wikipedia.org/wiki/Kurtosis#Estimators_of_population_kurtosis}
 * which is unbiased for the normal distribution.
 *
 * @method kurtosis
 * @methodOf ran.shape
 * @param {number[]} values Array of values to calculate skewness for.
 * @returns {(number|undefined)} The sample kurtosis of values if there are more than two and their variance is nonzero,
 * undefined otherwise.
 * @example
 *
 * ran.shape.kurtosis([])
 * // => undefined
 *
 * ran.shape.kurtosis([1, 2])
 * // => undefined
 *
 * ran.shape.kurtosis([1, 1, 1])
 * // => undefined
 *
 * ran.shape.kurtosis([1, 1, 3, 1, 1])
 * // => 5.000000000000003
 *
 * ran.shape.kurtosis([1, 2, 2, 2, 1])
 * // => -3.3333333333333326
 */
export default function (values) {
  if (values.length < 3) {
    return undefined
  }

  const n = values.length
  const m = mean(values)
  const m2 = mean(values.map(d => Math.pow(d - m, 2)))
  const m4 = mean(values.map(d => Math.pow(d - m, 4)))
  return m2 === 0 ? undefined : (n - 1) * ((n + 1) * m4 / (m2 * m2) - 3 * (n - 1)) / ((n - 2) * (n - 3))
}
