import logGamma from './log-gamma'

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
  return Math.exp(logGamma(x) + logGamma(y) - logGamma(x + y))
}
