// Coefficients
const coeffs = [
  -1.26551223,
  1.00002368,
  0.37409196,
  0.09678418,
  -0.18628806,
  0.27886807,
  -1.13520398,
  1.48851587,
  -0.82215223,
  0.17087277
]

/**
   * Error function.
   *
   * @method erf
   * @memberOf ran.special
   * @param {number} x Value to evaluate the error function at.
   * @returns {number} Error function value.
   * @private
   */
export default function (x) {
  let t = 1 / (1 + 0.5 * Math.abs(x))

  let tp = 1

  let sum = 0
  coeffs.forEach(c => {
    sum += c * tp
    tp *= t
  })
  let tau = t * Math.exp(sum - x * x)

  return x < 0 ? tau - 1 : 1 - tau
}
