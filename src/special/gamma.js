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

/**
   * Gamma function, using the Lanczos approximation.
   *
   * @method gamma
   * @memberOf ran.special
   * @param {number} z Value to evaluate Gamma function at.
   * @returns {number} Gamma function value.
   * @private
   */
function _gamma (z) {
  let y = 0
  if (z < 0.5) {
    y = Math.PI / (Math.sin(Math.PI * z) * _gamma(1 - z))
  } else {
    z--
    let x = 0.99999999999980993

    let l = coeffs.length
    coeffs.forEach((c, i) => {
      x += c / (z + i + 1)
      let t = z + l - 0.5
      y = Math.sqrt(2 * Math.PI) * Math.pow(t, (z + 0.5)) * Math.exp(-t) * x
    })
  }
  return y
}

export default _gamma
