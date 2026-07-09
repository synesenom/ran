import { logBeta, logGamma } from '../special'
import Distribution from './_distribution'
import rBeta from './_beta'
import gamma from './_gamma'
import poisson from './_poisson'

/**
 * Probability mass function for the [beta-negative-binomial distribution]{@link https://en.wikipedia.org/wiki/Beta_negative_binomial_distribution}:
 *
 * $f(k; r, \alpha, \beta) = \frac{\Gamma(r + k)}{\Gamma(k + 1) \Gamma(r)} \frac{\mathrm{B}(\alpha + r, \beta + k)}{\mathrm{B}(\alpha, \beta)},$
 *
 * with $r \in \mathbb{N}^+$ and $\alpha, \beta > 0$. Support: $k \in \mathbb{N}_0$.
 *
 * @class BetaNegativeBinomial
 * @memberof ran.dist
 * @constructor
 */
export default class BetaNegativeBinomial extends Distribution {
  /**
   * @param {number} r Number of successes (rounded to nearest integer).
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (r, alpha, beta) {
    super('discrete', 3)

    const ri = Math.round(r)
    this.p = { r: ri, alpha, beta }
    Distribution.validate({ r: ri, alpha, beta }, [
      'r > 0',
      'alpha > 0',
      'beta > 0'
    ])

    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    this.c = {
      logGammaR: logGamma(ri),
      logBetaAlphaBeta: logBeta(alpha, beta),
      // Base case p(0) = B(α+r, β)/B(α,β); precomputed to avoid recomputing on every _cdf call
      logBetaRatio: logBeta(alpha + ri, beta) - logBeta(alpha, beta)
    }
  }

  _pdf (k) {
    return Math.exp(
      logGamma(this.p.r + k) - logGamma(k + 1) - this.c.logGammaR +
      logBeta(this.p.alpha + this.p.r, this.p.beta + k) - this.c.logBetaAlphaBeta
    )
  }

  _cdf (k) {
    // Recurrence p(i) = p(i-1) * (r+i-1)*(β+i-1) / (i*(α+r+β+i-1)) from p(0) = exp(logBetaRatio)
    const { r, alpha, beta } = this.p
    let p = Math.exp(this.c.logBetaRatio)
    let sum = p
    for (let i = 1; i <= k; i++) {
      p *= (r + i - 1) * (beta + i - 1) / (i * (alpha + r + beta + i - 1))
      sum += p
    }
    return Math.min(1, sum)
  }

  static _fitInit (data) {
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    const variance = data.reduce((s, x) => s + x * x, 0) / data.length - mean * mean
    const m = Math.max(mean, 0.1)
    const v = Math.max(variance, m + 1)
    // NegBin moment-match gives a starting r; alpha=3 guarantees finite variance (alpha>2);
    // beta anchors E[k]=rβ/(α-1) to the sample mean
    const r = Math.max(1, Math.round(m * m / (v - m)))
    return [r, 3, Math.max(0.1, 2 * m / r)]
  }

  _generator () {
    // p ~ Beta(α,β); k|p ~ NegativeBinomial(r, 1-p) matches PMF B(α+r,β+k)/B(α,β)
    // NegativeBinomial success prob = 1-p, so gamma rate = p/(1-p)
    const p = rBeta(this.r, this.p.alpha, this.p.beta)
    return poisson(this.r, gamma(this.r, this.p.r, p / (1 - p)))
  }
}
