import riemannZeta from './riemann-zeta'
import hurwitzZeta from './hurwitz-zeta'
import neumaier from '../algorithms/neumaier'

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
  if (n < 10) {
    // Compensated sum avoids rounding errors for large m where terms drop off rapidly.
    const terms = []
    for (let k = 1; k <= n; k++) {
      terms.push(1 / k ** m)
    }
    return neumaier(terms)
  }

  // Otherwise use the zeta functions.
  return riemannZeta(m) - hurwitzZeta(m, n + 1)
}
