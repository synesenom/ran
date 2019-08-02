import acceleratedSum from '../algorithms/accelerated-sum'

/**
 * Computes Riemann zeta function (only real values outside the critical strip) using the alternating series.
 * Source: https://projecteuclid.org/download/pdf_1/euclid.em/1046889587
 *
 * @method riemannZeta
 * @memberOf ran.special
 * @param {number} s Value to evaluate Riemann zeta at.
 * @return {number} Value of the Riemann zeta function.
 * @private
 */
export default function (s) {
  const z = acceleratedSum(k => Math.pow(k + 1, -s))
  return z / (1 - Math.pow(2, 1 - s))
}
