/**
 * Computes Riemann zeta function (only real values outside the critical strip) using the alternating series.
 * Source: https://projecteuclid.org/download/pdf_1/euclid.em/1046889587
 *
 * @method riemannZeta
 * @memberOf ran.special
 * @param {number} s Value to evaluate Riemann zeta at.
 * @return {number} Value of the Riemann zeta function.
 * @private
 */
export default function (s) {
  let n = 30
  let d = Math.pow(3 + Math.sqrt(8), n)
  d = (d + 1 / d) / 2
  let b = -1
  let c = -d
  let z = 0

  for (let k = 0; k < n; k++) {
    let a = Math.pow(k + 1, -s)
    c = b - c
    z += c * a
    b = (k + n) * (k - n) * b / ((k + 0.5) * (k + 1))
  }

  return (z / d) / (1 - Math.pow(2, 1 - s))
}
