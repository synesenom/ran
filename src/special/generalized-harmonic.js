import riemannZeta from './riemann-zeta'
import hurwitzZeta from './hurwitz-zeta'
import digamma from './digamma'
import neumaier from '../algorithms/neumaier'

// Euler-Mascheroni constant γ; used for the m=1 identity H_n = γ + ψ(n+1).
const EULER_MASCHERONI = 0.5772156649015329

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

  // m=1 avoids ζ(1)−ζ(1,n+1) = ∞−∞ (NaN); use the exact identity H_n = γ + ψ(n+1) instead.
  if (m === 1) return EULER_MASCHERONI + digamma(n + 1)
  return riemannZeta(m) - hurwitzZeta(m, n + 1)
}
