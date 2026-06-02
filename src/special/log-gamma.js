/* eslint no-loss-of-precision: 0 */

// Coefficients
const COEFFS = [
  76.18009172947146,
  -86.50532032941677,
  24.01409824083091,
  -1.231739572450155,
  0.1208650973866179e-2,
  -0.5395239384953e-5
]

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

  const x = z

  let y = z

  let res = x + 5.5
  res = (x + 0.5) * Math.log(res) - res
  let sum = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    y++
    sum += COEFFS[j] / y
  }
  return res + Math.log(2.5066282746310005 * sum / x)
}
