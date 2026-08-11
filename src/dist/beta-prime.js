import { MAX_ITER } from '../core/constants'
import gamma, { BOOST_UNDERFLOW_THRESHOLD } from './_gamma'
import Beta from './beta'

/**
 * Probability density function for the [beta prime distribution]{@link https://en.wikipedia.org/wiki/Beta_prime_distribution} (also
 * known as inverted beta):
 *
 * $f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 + x)^{-\alpha - \beta}}{\mathrm{B}(\alpha, \beta)},$
 *
 * with $\alpha, \beta > 0$ and $\mathrm{B}(x, y)$ is the beta function.
 * Support: $x > 0$.
 *
 * @class BetaPrime
 * @memberof ran.dist
 * @constructor
 */
export default class BetaPrime extends Beta {
  // Transformation of beta distribution
  /**
   * @param {number} alpha First shape parameter.
   * @param {number} beta Second shape parameter.
   */
  constructor (alpha, beta) {
    super(alpha, beta)

    // Set support
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: Infinity,
      closed: false
    }]
  }

  static _fitInit (data) {
    // y = x/(1+x) maps BetaPrime's (0,∞) support to (0,1); Beta MOM in that space recovers (α,β)
    const n = data.length
    const y = data.map(x => x / (1 + x))
    const mean = y.reduce((s, x) => s + x, 0) / n
    const variance = y.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1e-4
    const factor = Math.max(mean * (1 - mean) / variance - 1, 0.1)
    return [mean * factor, (1 - mean) * factor]
  }

  _generator () {
    // Direct sampling from gamma (ignoring super). When beta < 1, y is drawn via
    // _gamma.js's small-shape boost branch, which can still return a subnormal
    // nonzero value close to Number.MIN_VALUE even after the #1379 zero-rejection
    // fix; dividing by it overflows x / y to Infinity, outside BetaPrime's open
    // (0, Infinity) support. Resample until the ratio is representable. (issue #1379)
    //
    // When alpha and beta are BOTH below _gamma.js's BOOST_UNDERFLOW_THRESHOLD, x and y
    // are provably exactly 0 on every attempt (decisions/0054-...), so x / y is 0 / 0 ->
    // NaN on every attempt, not a representable overflow the loop below could ever
    // resolve -- no amount of resampling helps. ln(x/y) ~ E_y/beta - E_x/alpha (same
    // small-shape tail asymptotic as the ADR), so the smaller shape parameter's draw
    // dominates the race to vanish, pulling the ratio toward the *opposite* boundary:
    // alpha < beta pulls x closer to 0 (x/y -> 0), alpha > beta pulls y closer to 0
    // (x/y -> Infinity), and alpha === beta is a symmetric coin flip. Resolved directly,
    // without entering the loop, since retrying a deterministic 0/0 cannot help.
    if (this.p.alpha < BOOST_UNDERFLOW_THRESHOLD && this.p.beta < BOOST_UNDERFLOW_THRESHOLD) {
      if (this.p.alpha < this.p.beta) return 0
      if (this.p.alpha > this.p.beta) return Infinity
      return this.r.next() < 0.5 ? 0 : Infinity
    }

    // Only reachable here when at most one of alpha/beta is below the threshold, so any
    // exhaustion is beta's y provably underflowing to exactly 0 with x representable --
    // x / y provably overflows on every attempt. The true ratio is not merely beyond
    // Number.MAX_VALUE but astronomically so, and Infinity is IEEE-754's own
    // correctly-rounded representation of a value that far out of range (per CLAUDE.md's
    // return-value table: a valid query whose answer diverges), not Number.MAX_VALUE,
    // which would understate it by hundreds of orders of magnitude. MAX_ITER-capped, that
    // is returned instead of looping forever. Worst case this compounds with _gamma.js's own
    // BOOST_MAX_ITER-bounded retry inside each gamma() call (see the gap-zone note there), but
    // stays bounded either way -- this issue's actual requirement. (issues #1379, #1384, #1386)
    for (let iter = 0; iter < MAX_ITER; iter++) {
      const x = gamma(this.r, this.p.alpha, 1)
      const y = gamma(this.r, this.p.beta, 1)
      const result = x / y
      if (Number.isFinite(result)) {
        return result
      }
    }
    return Infinity
  }

  _pdf (x) {
    return super._pdf(x / (1 + x)) / Math.pow(1 + x, 2)
  }

  _cdf (x) {
    return super._cdf(x / (1 + x))
  }

  /**
   * @returns {number} The mean of the distribution, or `Infinity` when `beta <= 1`.
   */
  mean () {
    return this.p.beta > 1 ? this.p.alpha / (this.p.beta - 1) : Infinity
  }

  /**
   * @returns {number} The variance of the distribution, or `Infinity` when `beta <= 2`.
   */
  variance () {
    const { alpha, beta } = this.p
    return beta > 2
      ? alpha * (alpha + beta - 1) / ((beta - 2) * (beta - 1) ** 2)
      : Infinity
  }

  /**
   * @returns {number} The skewness of the distribution, or `Infinity` when `beta <= 3`.
   */
  skewness () {
    const { alpha, beta } = this.p
    if (beta <= 3) return Infinity
    return 2 * (2 * alpha + beta - 1) / (beta - 3) *
      Math.sqrt((beta - 2) / (alpha * (alpha + beta - 1)))
  }

  /**
   * @returns {number} The excess kurtosis of the distribution, or `Infinity` when `beta <= 4`.
   */
  kurtosis () {
    const { alpha, beta } = this.p
    if (beta <= 4) return Infinity
    return 6 * (alpha * (alpha + beta - 1) * (5 * beta - 11) + (beta - 1) ** 2 * (beta - 2)) /
      (alpha * (alpha + beta - 1) * (beta - 3) * (beta - 4))
  }
}
