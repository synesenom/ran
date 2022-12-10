import riemannZeta from './riemann-zeta'
import hurwitzZeta from './hurwitz-zeta'

/**
 * Computes the generalized harmonic number H(n, m).
 *
 * @method generalizedHarmonic
 * @memberof ran.special
 * @param {number} n Number of terms in the sum.
 * @param {number} m Exponent of the sum.
 * @return {number} The generalized harmonic number H(n, m).
 * @private
 */
export default function (n, m) {
  if (n < 20) {
    // If n is small, just calculate it exactly.
    let z = 0
    for (let k = 1; k <= n; k++) {
      z += 1 / k ** m
    }
    return z
  }

  // Otherwise use the zeta functions.
  return riemannZeta(m) - hurwitzZeta(m, n + 1)
}
