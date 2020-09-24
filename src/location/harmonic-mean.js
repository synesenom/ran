import mean from './mean'

/**
 * Calculates the [harmonic mean]{@link https://en.wikipedia.org/wiki/Harmonic_mean} of an array of values.
 *
 * @method harmonicMean
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate harmonic mean for.
 * @returns {(number|undefined)} Harmonic mean of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.location.harmonicMean([])
 * // => undefined
 *
 * ran.location.harmonicMean([0, 1, 2])
 * // => undefined
 *
 * run.location.harmonicMean([-1, 2, 3])
 * // => undefined
 *
 * ran.location.harmonicMean([1, 2, 3])
 * // => 1.6363636363636365
 */
export default function (values) {
  if (values.reduce((acc, d) => acc && (d > 0), true)) {
    return 1 / mean(values.map(d => 1 / d))
  } else {
    return undefined
  }
}
