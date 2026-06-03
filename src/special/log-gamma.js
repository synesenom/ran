/* eslint no-loss-of-precision: 0 */

// g=7.5, n=9 Lanczos coefficients — identical to gamma.js, evaluated in log-space
// for ~1e-15 relative accuracy. The old 6-term NR set was capped at ~1e-13.
const COEFFS = [
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7
]
const LOG_SQRT_2PI = Math.log(2 * Math.PI) / 2

/**
   * Computes the logarithm of the absolute value of the gamma function, ln|Γ(z)|.
   *
   * @method logGamma
   * @memberof ran.special
   * @param {number} z Value to evaluate log(gamma) at.
   * @returns {number} The ln|Γ(z)| value; Infinity at the non-positive integer poles.
   * @private
   */
export default function logGamma (z) {
  if (z <= 0) {
    // Poles at the non-positive integers (ADR-0015 — divergence returns Infinity).
    if (Number.isInteger(z)) {
      return Infinity
    }
    // Log-reflection from Γ(z)Γ(1−z) = π/sin(πz): ln|Γ(z)| = ln π − ln|sin πz| − ln Γ(1−z).
    // |sin(πz)| is computed on the argument reduced modulo π (the sign dropped by abs is
    // irrelevant) so precision survives near a negative-integer pole, where forming π·z
    // directly would round away the tiny fractional offset.
    return Math.log(Math.PI) - Math.log(Math.abs(Math.sin(Math.PI * (z - Math.round(z))))) - logGamma(1 - z)
  }

  if (z < 0.5) {
    // Reflection keeps z in the Lanczos validity range [0.5, ∞).
    return Math.log(Math.PI) - Math.log(Math.abs(Math.sin(Math.PI * z))) - logGamma(1 - z)
  }

  z--
  let x = 0.99999999999980993
  const l = COEFFS.length
  COEFFS.forEach((c, i) => {
    x += c / (z + i + 1)
  })
  const t = z + l - 0.5
  return LOG_SQRT_2PI + (z + 0.5) * Math.log(t) - t + Math.log(x)
}
