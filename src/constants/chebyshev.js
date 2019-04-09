const coeffs = [
  [1],
  [0, 1],
  [-1, 0, 2],
  [0, -3, 0, 4],
  [1, 0, -8, 0, 8],
  [0, 5, 0, -20, 0, 16],
  [-1, 0, 18, 0, -48, 0, 32],
  [0, -7, 0, 56, 0, -112, 0, 64],
  [1, 0, -32, 0, 160, 0, -256, 0, 128],
  [0, 9, 0, -120, 0, 432, 0, -576, 0, 256],
  [-1, 0, 50, 0, -400, 0, 1120, 0, -1280, 0, 512],
  [0, -11, 0, 220, 0, -1232, 0, 2816, 0, -2816, 0, 1024]
]

/**
 * Computes the n-th Chebyshev polynomial.
 *
 * @method T
 * @memberOf ran.constants
 * @param {number} n Order of the polynomial.
 * @param {number} x Value to evaluate the polynomial at.
 * @returns {number} The function value.
 * @private
 */
export default function T (n, x) {
  if (n < 12) {
    let c = coeffs[n]
    let i = c.length - 1
    let y = c[i]
    while (i > 0) {
      y = y * x + c[--i]
    }
    return y
  } else {
    return 2 * x * T(n - 1, x) - T(n - 2, x)
  }
}
