import quickselect from '../algorithms/quickselect'

/**
 * Calculates the quantile at 0 < p < 1 using the R-7 algorithm.
 *
 * @method quantile
 * @memberof ran.utils
 * @param {number[]} values Array of values to calculate quantile for.
 * @param {number} p Value to calculate quantile at.
 * @return {(number|undefined)} The quantile of the sample if there is any, undefined otherwise.
 * @private
 */
export default function (values, p) {
  if (values.length === 0) {
    return undefined
  }

  const h = (values.length - 1) * p
  const h0 = Math.floor(h)
  const x0 = quickselect(values, h0)
  if (h0 < values.length - 1) {
    const x1 = quickselect(values, h0 + 1)
    return x0 + (h - h0) * (x1 - x0)
  } else {
    return x0
  }
}
