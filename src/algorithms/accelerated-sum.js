import { EPS } from '../core/constants'

/**
 * Computes the first n terms of an alternating series using Algorithm 1 in:
 * Henri Cohen, Fernando Rodriguez Villegas & Don Zagier (2000) Convergence Acceleration of Alternating Series,
 * Experimental Mathematics, 9:1, 3-12, DOI: 10.1080/10586458.2000.10504632
 *
 * @method acceleratedSum
 * @memberof ran.algorithms
 * @param {Function} a Function returning the k-th element of the series.
 * @returns {number} The sum of the series up to the first n-th terms.
 * @private
 */
export default function (a) {
  // This should be well above the threshold of 1.34 * D.
  const n = 30

  // Init variables.
  let d = Math.pow(3 + 2 * Math.SQRT2, n)
  d = (d + 1 / d) / 2
  let b = -1
  let c = -d
  let ds = 0
  let s = 0

  // Perform summation.
  for (let k = 0; k < n; k++) {
    c = b - c
    ds = c * a(k)
    s += ds

    // If the change is already below precision, just stop.
    if (Math.abs(ds / s) < EPS) {
      break
    }
    b *= (k + n) * (k - n) / ((k + 0.5) * (k + 1))
  }
  return s / d
}
