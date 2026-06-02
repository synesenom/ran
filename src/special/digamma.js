const coeffs = [
  1 / 12,
  1 / 120,
  1 / 252,
  1 / 240,
  1 / 132,
  691 / 32760
]

/**
 * Evaluates the digamma function using the Stirling series expansion.
 *
 * @method _psiSeries
 * @memberof ran.special
 * @param {number} z Argument to evaluate digamma for.
 * @returns {number} The estimated value.
 * @private
 */
function _psiSeries (z) {
  const z2 = z * z
  let s = 0
  for (let i = coeffs.length - 1; i >= 0; i--) {
    s = (coeffs[i] - s) / z2
  }
  return Math.log(z) - 0.5 / z - s
}

/**
 * Computes the digamma function ψ(z) = d/dz ln Γ(z) for arbitrary arguments.
 * Source: https://www.jstor.org/stable/2347257
 *
 * @method digamma
 * @memberof ran.special
 * @param {number} z Value to evaluate digamma at.
 * @returns {number} The digamma function value; Infinity at the non-positive integer poles.
 * @private
 */
function digamma (z) {
  // Simple poles at the non-positive integers (ADR-0015 — divergence returns ±Infinity).
  if (z <= 0 && Number.isInteger(z)) {
    return Infinity
  }

  // Reflection for z < 0. tan is π-periodic, so tan(πz) == tan(π·(z − round(z))); reducing the
  // argument first keeps full precision in cot(πz) near a negative-integer pole, where forming
  // π·z directly would round away the fractional offset that the pole term 1/(z−n) depends on.
  if (z < 0) {
    return digamma(1 - z) - Math.PI / Math.tan(Math.PI * (z - Math.round(z)))
  }

  // Shift z
  let s = 0
  while (z < 10) {
    s = s - 1 / z
    z = z + 1
  }
  return _psiSeries(z) + s
}

export default digamma
