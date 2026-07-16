import MCMC from './_mcmc'
import { Normal } from '../dist'
import Matrix from '../la/matrix'
import Vector from '../la/vector'

// Regularization added to the proposal covariance (Sigma_proposal = s_d * Cov(x) + EPS * I) so
// that ldl() -- which has no pivoting or singularity guard of its own -- never encounters a
// non-positive diagonal pivot, even while the online covariance accumulator is still rank
// deficient (fewer than dim + 1 observations).
const EPS = 1e-6

/**
 * Class implementing the full-covariance [adaptive Metropolis]{@link https://projecteuclid.org/euclid.bj/1080222083}
 * algorithm (Haario, Saksman & Tamminen, 2001). Unlike {@link ran.mc.RWM}, which adapts only the per-component
 * (diagonal) proposal scale, this sampler learns the full joint proposal covariance from the chain's own history
 * during warm-up: `Sigma_proposal = (2.38^2 / dim) * Cov(x) + epsilon * I`. The covariance is refactorized via
 * `Matrix.ldl()` after every warm-up iteration and frozen once `sample()` is called, since `_adjust` is only ever
 * invoked from `warmUp()`.
 *
 * @class AdaptiveMetropolis
 * @memberof ran.mc
 * @param {Function} logDensity The logarithm of the (unnormalized) target density.
 * @param {Object=} config AdaptiveMetropolis configuration (see MCMC base class for shared options).
 * @param {Object=} initialState Initial state of the sampler (see MCMC base class).
 * @constructor
 */
// decisions/0022-rwm-joint-adaptive-metropolis.md — anticipates full-covariance AM as a separate sampler
export default class AdaptiveMetropolis extends MCMC {
  constructor (logDensity, config, initialState) {
    super(logDensity, config, initialState)
    this.lastLnp = this.lnp(this.x)
    this._q = new Normal(0, 1)
    // Roberts-Gelman-Gilks (1997) asymptotically optimal scaling for a d-dimensional Gaussian target.
    this._sd = (2.38 * 2.38) / this.dim
    this._covN = 0
    this._covMean = new Array(this.dim).fill(0)
    this._covS = Array.from({ length: this.dim }, () => new Array(this.dim).fill(0))
    // Seeded from an isotropic guess (matching RWM's all-ones default) since the covariance
    // accumulator has no observations yet to base a better proposal on (see _adjust).
    this._A = this.internal.proposal
      ? new Matrix(this.internal.proposal)
      : new Matrix(this.dim).scale(Math.sqrt(this._sd))
  }

  /**
   * Sets the seed for the sampler's pseudo random number generator, including the internal
   * proposal distribution's generator.
   *
   * @method seed
   * @memberof ran.mc.AdaptiveMetropolis
   * @param {number|string} value The value of the seed, either a number or a string (for the ease of tracking seeds).
   * @returns {this} Reference to the current sampler.
   * @ignore
   */
  seed (value) {
    super.seed(value)
    this._reseedCachedLogDensity(value)
    return this
  }

  _iter (x) {
    const z = new Vector(Array.from({ length: this.dim }, () => this._q.sample()))
    const jump = this._A.apply(z).v()
    const x1 = x.map((d, i) => d + jump[i])
    const newLnp = this.lnp(x1)
    const accepted = this.r.next() < Math.exp(newLnp - this.lastLnp)
    if (accepted) {
      this.lastLnp = newLnp
      return { x: x1, accepted }
    }
    return { x, accepted }
  }

  _adjust (i) {
    this._updateCovariance(i.x)
    // The 2*dim gate is a statistical-quality threshold, not a numerical-safety one: EPS * I
    // alone keeps Sigma_proposal positive definite (and ldl() well-defined) from n = 1 onward.
    if (this._covN >= 2 * this.dim) {
      this._refreshFactor()
    }
  }

  _internal () {
    // Serialize only the effective, ready-to-use proposal transform (mirrors RWM._internal()'s
    // "serialize the effective proposal, not raw adaptation counters" convention) so a resumed
    // sampler reproduces the same joint proposal directly, without recomputing ldl().
    return { proposal: this._A.m() }
  }

  // Online (Welford-style) update of the running mean and sum-of-outer-products accumulators,
  // the matrix generalization of the per-dimension recurrence the base class already uses for
  // its own Welford accumulator (see src/mc/_mcmc.js's _updateAccumulators).
  _updateCovariance (x) {
    this._covN++
    const n = this._covN
    const delta = x.map((v, i) => v - this._covMean[i])
    for (let i = 0; i < this.dim; i++) {
      this._covMean[i] += delta[i] / n
    }
    const delta2 = x.map((v, i) => v - this._covMean[i])
    for (let i = 0; i < this.dim; i++) {
      for (let j = 0; j < this.dim; j++) {
        this._covS[i][j] += delta[i] * delta2[j]
      }
    }
  }

  // Refactorizes Sigma_proposal = s_d * Cov(x) + EPS * I via LDL decomposition and combines the
  // factors into a single proposal transform A = L * D^(1/2), so _iter needs only one matrix-vector
  // product (A * z) per step instead of separately tracking L and D. The EPS*I term is rebuilt here
  // rather than cached as a field: a cached Matrix instance's type is inferred from Matrix.scale()'s
  // own JSDoc (ran.la.Matrix), which breaks npm run typecheck since `la` isn't in the public API's
  // type graph — see solutions/tooling/2026-07-15-1330-adaptive-metropolis-ran-la-matrix-dts-leak.md
  _refreshFactor () {
    const cov = new Matrix(this._covS).scale(this._sd / (this._covN - 1)).add(new Matrix(this.dim).scale(EPS))
    const { D, L } = cov.ldl()
    this._A = L.mult(D.f(Math.sqrt))
  }
}
