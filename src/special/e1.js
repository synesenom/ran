// Euler-Mascheroni constant for the series expansion
const EULER_MASCHERONI = 0.5772156649015329

/**
 * Exponential integral E₁(z) = ∫_z^∞ e^{-t}/t dt.
 *
 * @method e1
 * @memberof ran.special
 * @param {number} z Positive argument.
 * @returns {number} E₁(z); Infinity at z=0, NaN for z<0.
 */
export default function e1 (z) {
  if (z <= 0) return z === 0 ? Infinity : NaN

  if (z <= 1) {
    // A&S 5.1.11: E₁(z) = -γ - ln(z) + Σ_{n=1}^∞ (-1)^{n+1} z^n / (n · n!)
    // Recurrence: term_{n+1} = term_n × (-z · n / (n+1)²) avoids recomputing factorials
    let sum = 0
    let term = z
    for (let n = 1; n <= 100; n++) {
      sum += term
      term *= -z * n / ((n + 1) * (n + 1))
      if (Math.abs(term) < Number.EPSILON * Math.abs(sum)) break
    }
    return -EULER_MASCHERONI - Math.log(z) + sum
  }

  // Continued fraction (A&S 5.1.22): e^z E₁(z) = 1/(z+) 1/(1+) 1/(z+) 2/(1+) 2/(z+) ...
  // Denominators bₙ (n≥2): 1 when n even, z when n odd; numerators aₙ (n≥2): ceil((n-1)/2)
  // See solutions/special-functions/2026-06-14-1240-e1-asymptotic-vs-continued-fraction-crossover.md
  let f = 1 / z
  let c = 1 / 1e-30
  let d = 1 / z
  for (let n = 2; n <= 200; n++) {
    const an = Math.ceil((n - 1) / 2)
    const bn = n % 2 === 0 ? 1 : z
    d = bn + an * d
    d = Math.abs(d) < 1e-30 ? 1e-30 : d
    d = 1 / d
    c = bn + an / c
    c = Math.abs(c) < 1e-30 ? 1e-30 : c
    const delta = c * d
    f *= delta
    if (Math.abs(delta - 1) < Number.EPSILON) break
  }
  return Math.exp(-z) * f
}
