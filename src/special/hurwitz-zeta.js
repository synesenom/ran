import { EPS } from '../core/constants'
import { B2k } from '../constants/bernoulli'

/**
 * Computes the Hurwitz zeta function (only real values outside the critical strip) using the alternating series.
 * Source: https://projecteuclid.org/download/pdf_1/euclid.em/1046889587
 *
 * @method hurwitzZeta
 * @memberof ran.special
 * @param {number} s Exponent.
 * @param {number} a Shift.
 * @return {number} Value of the Hurwitz zeta function.
 * @private
 */
export default function (s, a) {
  // Pole at s = 1; return Infinity per ADR-0015 (divergent math → ±Infinity).
  if (Math.abs(s - 1) < EPS) {
    return Infinity
  }

  // Enough partial-sum terms that the Euler-Maclaurin tail is accurate: at s near 1 the
  // series decays as k^{-(s-1)} which is slow, so n must grow as 1/(s-1). The floor of 50
  // ensures the Bernoulli series reaches 1e-14 for all s ∈ (1, 3].
  const n = Math.max(50, Math.min(100, Math.ceil(1 / Math.max(s - 1, EPS))))

  // First sum
  let z = 0
  for (let k = 0; k <= n; k++) {
    z += Math.pow(a + k, -s)
  }
  z += Math.pow(a + n, 1 - s) / (s - 1) - 0.5 / Math.pow(a + n, s)

  // Bernoulli correction series using the ratio recurrence:
  // T_k = B_{2k}/(2k)! * Γ(s+2k-1)/Γ(s) * N^{-(s+2k-1)}, with
  // T_k/T_{k-1} = (B_{2k}/B_{2k-2}) * (s+2k-3)(s+2k-2) / ((2k)(2k-1)) / N^2
  const N = a + n
  let c = B2k[0] * s / (2 * Math.pow(N, s + 1))
  z += c
  for (let k = 2; k < B2k.length; k++) {
    c *= (B2k[k - 1] / B2k[k - 2]) * (s + 2 * k - 3) * (s + 2 * k - 2) / ((2 * k) * (2 * k - 1)) / (N * N)
    z += c
    if (Math.abs(c / z) < EPS) { break }
  }

  return z
}
