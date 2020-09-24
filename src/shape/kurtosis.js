import mean from '../location/mean'
import moment from './moment'

/**
 * Calculates the [sample excess kurtosis]{@link https://en.wikipedia.org/wiki/Kurtosis#Estimators_of_population_kurtosis}
 * which is unbiased for the normal distribution.
 *
 * @method kurtosis
 * @memberof ran.shape
 * @param {number[]} values Array of values to calculate kurtosis for.
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
  const m2 = moment(values, 2, m)
  const m4 = moment(values, 4, m)
  return m2 === 0 ? undefined : (n - 1) * ((n + 1) * m4 / (m2 * m2) - 3 * (n - 1)) / ((n - 2) * (n - 3))
}
