import { logBinomial, regularizedBetaIncomplete } from '../special'
import Distribution from './_distribution'

/**
 * The pushforward of Binomial(n, p) under x = 2k - n. Used only as the return value of
 * RandomWalk.marginal(t) — decisions/0045-private-distribution-subclass-for-process-marginals.md.
 * Not exported from src/dist/index.js: fit() is not part of the API surface marginal()'s contract
 * promises, so this skips the "Adding a New Distribution" checklist (dist-cases, precision gate,
 * subpath export).
 *
 * @class ShiftedBinomial
 * @memberof ran.dist
 * @private
 */
export default class ShiftedBinomial extends Distribution {
  /**
   * @param {number} n Number of trials (must be >= 0).
   * @param {number} p Probability of a +1 step (must satisfy 0 < p < 1).
   */
  constructor (n, p) {
    super('discrete', 2)

    const ni = Math.round(n)
    this.p = { n: ni, p }
    // Only RandomWalk.marginal() constructs this class, always with its own already-validated
    // 0 < p < 1 — strict bounds keep log(p)/log(1-p) below finite in _pdf/_cdf without guards.
    Distribution.validate({ n: ni, p }, [
      'n >= 0',
      'p > 0', 'p < 1'
    ])

    this.s = [{
      value: -ni,
      closed: true
    }, {
      value: ni,
      closed: true
    }]

    // logP/log1mP are shared by every _pdf/_cdf call for the lifetime of this instance
    this.c = {
      logP: Math.log(p),
      log1mP: Math.log(1 - p)
    }
  }

  _generator () {
    let heads = 0
    for (let i = 0; i < this.p.n; i++) {
      if (this.r.next() < this.p.p) heads++
    }
    return 2 * heads - this.p.n
  }

  _pdf (x) {
    // x and n must share parity: k = (n+x)/2 is only an integer trial count on the lattice.
    // n=0 (RandomWalk.marginal(0)'s point mass) falls out of this formula directly: the only
    // on-parity point is x=0, giving k=0 and logBinomial(0,0)=0, so pdf(0)=1 with no extra guard.
    if ((this.p.n + x) % 2 !== 0) return 0
    const k = (this.p.n + x) / 2
    return Math.exp(logBinomial(this.p.n, k) + k * this.c.logP + (this.p.n - k) * this.c.log1mP)
  }

  _cdf (x) {
    // x may fall between lattice points (wrong parity); floor maps it to the highest reachable k
    const k = Math.floor((this.p.n + x) / 2)
    return regularizedBetaIncomplete(this.p.n - k, k + 1, 1 - this.p.p)
  }

  // The default discrete quantile fallback (_qEstimateTable) hardwires its walk start at k=0
  // and is documented broken for negative-integer support — see
  // solutions/algorithm/2026-05-20-0647-q-estimate-walk-infinite-support-discrete.md
  _q (p) {
    return this._qEstimateWalk(p, Math.round(this.mean()))
  }

  // Implemented despite ADR-0045's exemption: CLAUDE.md's "_fitInit always, never omit" rule has
  // no textual private-class carve-out, so the stricter rule wins — see
  // solutions/distribution/2026-07-31-0850-shifted-binomial-private-distribution-fitinit-conflict.md
  static _fitInit (data) {
    // Support is symmetric [-n, n]; n ≈ the largest |x| observed. mean(X) = n(2p-1) inverts to p.
    const n = Math.max(1, data.reduce((m, x) => Math.max(m, Math.abs(x)), 0))
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    const p = Math.min(0.99, Math.max(0.01, (mean / n + 1) / 2))
    return [n, p]
  }

  mean () {
    return this.p.n * (2 * this.p.p - 1)
  }

  variance () {
    return 4 * this.p.n * this.p.p * (1 - this.p.p)
  }
}
