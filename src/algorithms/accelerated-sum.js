/**
 * Computes the first n terms of an alternating series.
 * Source: https://projecteuclid.org/download/pdf_1/euclid.em/1046889587
 *
 * @method acceleratedSum
 * @memberof ran.algorithms
 * @param {Function} a Function returning the k-th element of the series.
 * @returns {number} The sum of the series up to the first n-th terms.
 * @private
 */
import { EPS } from '../special/_core'

export default function (a) {
  const n = 30
  let d = Math.pow(3 + 2 * Math.SQRT2, n)
  d = (d + 1 / d) / 2
  let b = -1
  let c = -d
  let ds = 0
  let s = 0
  for (let k = 0; k < n; k++) {
    c = b - c
    ds = c * a(k)
    s += ds
    if (Math.abs(ds / s) < EPS) {
      break
    }
    b *= (k + n) * (k - n) / ((k + 0.5) * (k + 1))
  }
  return s / d
}
