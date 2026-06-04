import wynnEpsilon from '../algorithms/wynn-epsilon'

// Euler-Mascheroni constant γ₀ (DLMF 5.2.3)
const EULER_MASCHERONI = 0.5772156649015329

// First Stieltjes constant γ₁ (DLMF 25.2.8; negative by convention)
const STIELTJES_1 = -0.0728158454836767

// Second Stieltjes constant γ₂ (DLMF 25.2.8)
const STIELTJES_2 = -0.0096903631928723

// Third Stieltjes constant γ₃ (DLMF 25.2.8)
const STIELTJES_3 = 0.002053834420303346

// Fourth Stieltjes constant γ₄ (DLMF 25.2.8)
const STIELTJES_4 = 0.002320213071774184

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
  // the five-term Laurent expansion avoids the division entirely.
  if (d > -0.01 && d < 0.1001) {
    return 1 / d + EULER_MASCHERONI - STIELTJES_1 * d + STIELTJES_2 * d * d / 2 -
      STIELTJES_3 * d * d * d / 6 + STIELTJES_4 * d * d * d * d / 24
  }
  const z = wynnEpsilon(k => Math.pow(-1, k) * Math.pow(k + 1, -s))
  return z / (1 - Math.pow(2, 1 - s))
}
