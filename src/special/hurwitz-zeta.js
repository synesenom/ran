import { EPS } from './_core'
import { B2k } from '../constants/bernoulli'
import logGamma from './log-gamma'

/**
 * Computes the Hurwitz zeta function (only real values outside the critical strip) using the alternating series.
 * Source: https://projecteuclid.org/download/pdf_1/euclid.em/1046889587
 *
 * @method hurwitzZeta
 * @memberOf ran.special
 * @param {number} s Exponent.
 * @param {number} a Shift.
 * @return {number} Value of the Hurwitz zeta function.
 * @private
 */
export default function (s, a) {
  const n = 20

  // First sum
  let z = 0
  for (let k = 0; k <= n; k++) {
    z += Math.pow(a + k, -s)
  }
  z += Math.pow(a + n, 1 - s) / (s - 1) - 0.5 / Math.pow(a + n, s)

  // Second sum
  let c = 1
  for (let k = 1; k < B2k.length; k++) {
    // Update coefficient
    let m = logGamma(s + 4 * k - 3) - logGamma(s + 2 * k - 2)
    m -= (s + 2 * k - 1) * Math.log(a + n)
    m -= logGamma(2 * k + 1)
    c *= B2k[k - 1] * Math.exp(m)

    // Increment sum
    z += c

    // Stop if precision achieved
    if (Math.abs(c / z) < EPS) { break }
  }

  return z
}
