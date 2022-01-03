import max from '../shape/max'
import min from '../shape/min'

/**
 * Calculates the [range]{@link https://en.wikipedia.org/wiki/Range_(statistics)} for a sample of values.
 *
 * @method range
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate range for.
 * @return {(number|undefined)} The range of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.dispersion.range([])
 * // => undefined
 *
 * ran.dispersion.range([0, 1, 2, 2])
 * // => 2
 */
export default function (values) {
  if (values.length === 0) {
    return undefined
  }

  return max(values) - min(values)
}
