import wynnEpsilon from '../algorithms/wynn-epsilon'

// Euler-Mascheroni constant γ₀ (DLMF 5.2.3)
const EULER_MASCHERONI = 0.5772156649015329

// First Stieltjes constant γ₁ (DLMF 25.2.8; negative by convention)
const STIELTJES_1 = -0.0728158454836767

/**
 * Computes Riemann zeta function (only real values outside the critical strip) using the alternating series.
 * Source: https://projecteuclid.org/download/pdf_1/euclid.em/1046889587
 *
 * @method riemannZeta
 * @memberof ran.special
 * @param {number} s Value to evaluate Riemann zeta at.
 * @return {number} Value of the Riemann zeta function.
 * @private
 */
export default function (s) {
  const d = s - 1
  // Near the pole at s=1 the denominator 1−2^(1−s) vanishes, causing catastrophic cancellation;
  // the two-term Laurent expansion avoids the division entirely.
  if (Math.abs(d) < 0.01) {
    return 1 / d + EULER_MASCHERONI - STIELTJES_1 * d
  }
  const z = wynnEpsilon(k => Math.pow(-1, k) * Math.pow(k + 1, -s))
  return z / (1 - Math.pow(2, 1 - s))
}
