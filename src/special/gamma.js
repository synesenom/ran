// Coefficients
const coeffs = [
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7
]
const SQRT_PI2 = Math.sqrt(2 * Math.PI)

/**
   * Gamma function, using the Lanczos approximation.
   *
   * @method gamma
   * @memberof ran.special
   * @param {number} z Value to evaluate Gamma function at.
   * @returns {number} Gamma function value; Infinity at the non-positive integer poles.
   * @private
   */
function _gamma (z) {
  // Simple poles at the non-positive integers: Γ diverges (ADR-0015 — divergence returns ±Infinity).
  // Without this guard the reflection branch evaluates sin(πz) at a floating-point value that is
  // ~1e-16 rather than exactly 0, yielding a huge finite number instead of Infinity.
  if (z <= 0 && Number.isInteger(z)) {
    return Infinity
  }

  let y
  if (z < 0.5) {
    // Reduce sin(πz) modulo π and carry the (-1)^n sign separately: forming π·z directly rounds
    // away the tiny fractional offset near a negative-integer pole, destroying precision there.
    const n = Math.round(z)
    const sign = n % 2 === 0 ? 1 : -1
    y = Math.PI / (sign * Math.sin(Math.PI * (z - n)) * _gamma(1 - z))
  } else {
    z--
    let x = 0.99999999999980993

    const l = coeffs.length
    coeffs.forEach((c, i) => {
      x += c / (z + i + 1)
    })
    const t = z + l - 0.5
    y = SQRT_PI2 * Math.pow(t, (z + 0.5)) * Math.exp(-t) * x
  }
  return y
}

export default _gamma
