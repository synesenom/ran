import { riemannZeta, gamma as gammaFn, gammaUpperIncomplete } from '../special'
import { B2k } from '../constants/bernoulli'
import { EPS } from '../core/constants'
import gamma from './_gamma'
import zeta from './_zeta'
import Distribution from './_distribution'

// B_{2j}/(2j)! for j=1..18, used in the Laurent/Bernoulli CDF series
const B2K_OVER_FACT = (() => {
  const r = []
  let fact = 1
  for (let j = 1; j <= B2k.length; j++) {
    fact *= (2 * j - 1) * (2 * j)
    r.push(B2k[j - 1] / fact)
  }
  return r
})()

/**
 * Probability density function for the [Davis distribution]{@link https://en.wikipedia.org/wiki/Davis_distribution}:
 *
 * $f(x; \mu, b, n) = \frac{b^n (x - \mu)^{-1-n}}{\Gamma(n)\,\zeta(n)\,(e^{b/(x-\mu)} - 1)},$
 *
 * with $\mu > 0$, $b > 0$, and $n > 1$. Support: $x \in (\mu, \infty)$.
 *
 * @class Davis
 * @memberof ran.dist
 * @constructor
 */
export default class Davis extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} b Scale parameter.
   * @param {number} n Shape parameter. Must be greater than 1.
   */
  constructor (mu, b, n) {
    super('continuous', 3)

    // Validate parameters.
    this.p = { mu, b, n }
    Distribution.validate({ mu, b, n }, [
      'mu > 0',
      'b > 0',
      'n > 1'
    ])

    // Set support.
    this.s = [{
      value: mu,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Pre-compute constants that appear in every _pdf call.
    // See solutions/distribution/2026-05-27-1530-davis-romberg-boundary-guard-and-constant-cache.md
    this.c = {
      bn: Math.pow(b, n),
      gammaN: gammaFn(n),
      zetaN: riemannZeta(n)
    }
  }

  static _fitInit (data) {
    // mu≈min−ε (location, kept in (0,min)); fixed shape n=2.5, scale b from the mean of the shifted data
    const n = data.length
    const min = Math.min(...data)
    // min*(1−1e-3) keeps mu strictly below min for any positive min; the 1e-6 floor keeps mu>0 even for degenerate (non-positive) data
    const mu = Math.max(min - 1e-3 * (Math.abs(min) + 1), min * (1 - 1e-3), 1e-6)
    const shiftedMean = data.reduce((s, x) => s + (x - mu), 0) / n
    return [mu, Math.max(shiftedMean, 1e-3), 2.5]
  }

  _generator () {
    // Zeta-Gamma mixture: Davis(mu, b, n) = mu + b / Gamma(n, Zeta(n))
    const k = zeta(this.r, this.p.n)
    return this.p.mu + this.p.b / gamma(this.r, this.p.n, k)
  }

  _pdf (x) {
    const y = x - this.p.mu
    if (y <= 0) return 0
    const bOverY = this.p.b / y
    // exp(bOverY) overflows to Infinity for bOverY > ~709; PDF → 0 in that limit
    if (bOverY > 700) return 0
    return this.c.bn * Math.pow(y, -1 - this.p.n) / (this.c.gammaN * this.c.zetaN * Math.expm1(bOverY))
  }

  // See solutions/distribution/2026-05-30-2141-davis-bose-einstein-cdf-series.md
  _cdf (x) {
    if (x <= this.p.mu) return 0
    const T = this.p.b / (x - this.p.mu)
    const n = this.p.n

    if (T > 2) {
      // Upper incomplete gamma series: F = (1/ζ(n)) Σ_{k≥1} Q(n,kT)/k^n
      // Convergence: Q(n,kT) ~ (kT)^{n-1} e^{-kT}/Γ(n) → exponentially fast in k
      let sum = 0
      for (let k = 1; k <= 20; k++) {
        const term = gammaUpperIncomplete(n, k * T) / Math.pow(k, n)
        sum += term
        if (term < sum * EPS) break
      }
      return sum / this.c.zetaN
    }

    // Bernoulli/Laurent series for 1-F: valid for T < 2π, fastest for T ≤ 2
    // ∫₀ᵀ t^{n-1}/(eᵗ-1) dt = T^{n-1}/(n-1) - T^n/(2n) + Σ B_{2j}/(2j)! · T^{n+2j-1}/(n+2j-1)
    let integral = Math.pow(T, n - 1) / (n - 1) - Math.pow(T, n) / (2 * n)
    let Tpow = Math.pow(T, n + 1)
    const T2 = T * T
    for (let j = 1; j <= B2K_OVER_FACT.length; j++) {
      const term = B2K_OVER_FACT[j - 1] * Tpow / (n + 2 * j - 1)
      integral += term
      Tpow *= T2
      if (Math.abs(term) < Math.abs(integral) * EPS) break
    }
    return 1 - integral / (this.c.gammaN * this.c.zetaN)
  }
}
