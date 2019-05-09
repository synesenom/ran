// Coefficients
const coeffs = [
  76.18009172947146,
  -86.50532032941677,
  24.01409824083091,
  -1.231739572450155,
  0.1208650973866179e-2,
  -0.5395239384953e-5
]

function _logGamma(z) {
  let x = z

  let y = z

  let tmp = x + 5.5
  tmp = (x + 0.5) * Math.log(tmp) - tmp
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    y++
    ser += coeffs[j] / y
  }
  return tmp + Math.log(2.5066282746310005 * ser / x)
}

/**
   * Computes the logarithm of the gamma function.
   *
   * @method logGamma
   * @memberOf ran.special
   * @param {number} z Value to evaluate log(gamma) at.
   * @returns {number} The log(gamma) value.
   * @private
   */
export default function (z) {
  // If z > 0, simply compute log-gamma
  if (z > 0) {
    return _logGamma(z)
  } else {
    // Otherwise, compute it iteratively starting from the first positive argument
    let k = z - Math.floor(z)
    let g = _logGamma(k)
    k = -k
    while (k < -z) {
      k++
      g -= Math.log(k)
    }
    return g
  }
}
