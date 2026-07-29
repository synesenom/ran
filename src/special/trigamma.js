// Bernoulli numbers B_2, B_4, ..., B_12: the trigamma asymptotic series coefficients
// carry their sign directly (unlike digamma's series, which factors out an extra 1/(2k)
// and folds the alternation into the recursion instead), so no sign trick is needed here.
const coeffs = [
  1 / 6,
  -1 / 30,
  1 / 42,
  -1 / 30,
  5 / 66,
  -691 / 2730
]

/**
 * Evaluates the trigamma function using the Stirling series expansion.
 *
 * @method _psi1Series
 * @memberof ran.special
 * @param {number} z Argument to evaluate trigamma for.
 * @returns {number} The estimated value.
 * @private
 */
function _psi1Series (z) {
  const z2 = z * z
  let p = 0
  for (let i = coeffs.length - 1; i >= 0; i--) {
    p = coeffs[i] + p / z2
  }
  return 1 / z + 0.5 / z2 + p / (z2 * z)
}

/**
 * Computes the trigamma function ψ1(z) = d/dz ψ(z) = d²/dz² ln Γ(z) for arbitrary arguments.
 * Source: https://en.wikipedia.org/wiki/Trigamma_function
 *
 * @method trigamma
 * @memberof ran.special
 * @param {number} z Value to evaluate trigamma at.
 * @returns {number} The trigamma function value; Infinity at the non-positive integer poles.
 * @private
 */
function trigamma (z) {
  // Simple poles at the non-positive integers (ADR-0015 — divergence returns ±Infinity).
  if (z <= 0 && Number.isInteger(z)) {
    return Infinity
  }

  // Reflection for z < 0. sin(pi*z) has period 2 but sin^2(pi*z) has period 1, so reducing
  // the argument first keeps full precision near a negative-integer pole, where forming
  // pi*z directly would round away the fractional offset the pole term depends on.
  if (z < 0) {
    const s = Math.sin(Math.PI * (z - Math.round(z)))
    return (Math.PI * Math.PI) / (s * s) - trigamma(1 - z)
  }

  // Shift z upward via psi1(z) = psi1(z+1) + 1/z^2, accumulating the correction terms.
  let s = 0
  while (z < 10) {
    s = s + 1 / (z * z)
    z = z + 1
  }
  return _psi1Series(z) + s
}

export default trigamma
