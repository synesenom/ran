// Coefficients
import gamma from './gamma'

const coeffs = [
  76.18009172947146,
  -86.50532032941677,
  24.01409824083091,
  -1.231739572450155,
  0.1208650973866179e-2,
  -0.5395239384953e-5
]

/**
   * Computes the logarithm of the gamma function for positive arguments.
   *
   * @method logGamma
   * @memberOf ran.special
   * @param {number} z Value to evaluate log(gamma) at.
   * @returns {number} The log(gamma) value.
   * @private
   */
export default function (z) {
  let x = z

  let y = z

  let res = x + 5.5
  res = (x + 0.5) * Math.log(res) - res
  let sum = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    y++
    sum += coeffs[j] / y
  }
  return res + Math.log(2.5066282746310005 * sum / x)
}
