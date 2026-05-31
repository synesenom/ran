import mean from '../location/mean'
import moment from './moment'

/**
 * Calculates the [Fisher-Pearson standardized sample skewness]{@link https://en.wikipedia.org/wiki/Skewness#Sample_skewness}
 * for a sample of values.
 *
 * @method skewness
 * @memberof ran.shape
 * @param {number[]} values Array of values to calculate skewness for.
 * @returns {number} The sample skewness, or NaN for fewer than 3 elements or zero variance.
 * @example
 *
 * ran.shape.skewness([])
 * // => NaN
 *
 * ran.shape.skewness([1, 2])
 * // => NaN
 *
 * ran.shape.skewness([1, 1, 1])
 * // => NaN
 *
 * ran.shape.skewness([1, 1, 1, 2])
 * // => 2
 *
 * ran.shape.skewness([1, 2, 2, 2])
 * // => -2
 */
export default function (values) {
  if (values.length < 3) {
    return NaN
  }

  const n = values.length
  const m = mean(values)
  const m2 = moment(values, 2, m)
  const m3 = moment(values, 3, m)
  return m2 === 0 ? NaN : Math.sqrt(n * (n - 1)) * m3 / ((n - 2) * Math.pow(m2, 1.5))
}
