import logGamma from './log-gamma'

/**
 * Sign of Gamma(z) for real z, needed because logGamma() intentionally returns
 * ln|Gamma(z)| (the log of a negative number is not real), so composing it back
 * into Gamma-ratio formulas via Math.exp() loses the sign for z < 0.
 *
 * Derivation from Euler's reflection formula Gamma(z)Gamma(1-z) = pi / sin(pi*z):
 * for non-integer z < 1 (in particular every z < 0), 1-z > 0 is a positive
 * non-integer, so Gamma(1-z) > 0. Rearranging, Gamma(z) = pi / (sin(pi*z) *
 * Gamma(1-z)), and since pi > 0 and Gamma(1-z) > 0, sign(Gamma(z)) = sign(sin(pi*z)).
 * For z > 0, Gamma(z) > 0 always. At non-positive integers Gamma has a pole;
 * logGamma() already returns Infinity there (out of scope to change here), so
 * this returns 1 to leave that Infinity untouched.
 *
 * @method _gammaSign
 * @memberof ran.special
 * @param {number} z Value to evaluate sign(Gamma(z)) at.
 * @returns {number} 1 or -1, the sign of Gamma(z) (1 at poles, by convention).
 * @private
 */
function _gammaSign (z) {
  if (z > 0 || Number.isInteger(z)) {
    return 1
  }
  return Math.sign(Math.sin(Math.PI * z))
}

/**
 * Beta function.
 *
 * @method beta
 * @memberof ran.special
 * @param {number} x First argument.
 * @param {number} y Second argument.
 * @returns {number} The value of the beta function.
 * @private
 */
export default function (x, y) {
  // solutions/special-functions/2026-06-03-0920-beta-integer-lanczos-ulp-quantile-overshoot.md
  // The Lanczos round-trip through three logGamma calls accumulates sub-ULP
  // error for integer arguments (e.g. beta(1,4) returns 0.67 ULPs above 0.25),
  // which can push an exactly-representable result past its IEEE 754 value and
  // break strict >= comparisons in discrete quantile search. The recurrence
  // B(1,n)=1/n, B(m,n)=B(m-1,n)*(m-1)/(m+n-1) is exact for small integers:
  // every step multiplies by a ratio of integers <= 60, well within 53-bit mantissa.
  if (Number.isInteger(x) && Number.isInteger(y) && x >= 1 && y >= 1) {
    let m = x
    let n = y
    if (m > n) { [m, n] = [n, m] }
    if (m <= 30) {
      let b = 1 / n
      for (let i = 2; i <= m; i++) {
        b *= (i - 1) / (n + i - 1)
      }
      return b
    }
  }
  return _gammaSign(x) * _gammaSign(y) * _gammaSign(x + y) *
    Math.exp(logGamma(x) + logGamma(y) - logGamma(x + y))
}
