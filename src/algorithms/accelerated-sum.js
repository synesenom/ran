/**
 * Computes the first n terms of an alternating series.
 * Source: https://projecteuclid.org/download/pdf_1/euclid.em/1046889587
 *
 * @method acceleratedSum
 * @memberOf ran.algorithms
 * @param {Function} a Function returning the k-th element of the series.
 * @param {number} n Number of terms to consider.
 * @returns {number} The sum of the series up to the first n-th terms.
 * @private
 */
export default function (a, n = 20) {
  let d = Math.pow(3 + 2 * Math.SQRT2, n)
  d = (d + 1 / d) / 2
  let b = -1
  let c = -d
  let s = 0
  for (let k = 0; k < n; k++) {
    c = b - c
    s += c * a(k)
    b *= (k + n) * (k - n) / ((k + 0.5) * (k + 1))
  }
  return s / d
}
