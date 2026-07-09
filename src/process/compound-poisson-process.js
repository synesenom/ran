import poisson from '../dist/_poisson'
import Process from './_process'

/**
 * Compound Poisson process: cumulative random-magnitude jumps arriving at a Poisson rate.
 *
 * At each time step of width $\mathrm{d}t$ the state advances by the sum of
 * $K \sim \mathrm{Poisson}(\lambda\,\mathrm{d}t)$ independent jumps drawn from
 * the supplied distribution:
 *
 * $X_{n+1} = X_n + \sum_{i=1}^{K} J_i, \quad K \sim \mathrm{Poisson}(\lambda\,\mathrm{d}t), \quad J_i \sim \text{jumpDist.}$
 *
 * The marginal moments satisfy the compound Poisson identities:
 * $\mathrm{E}[X(t)] = \lambda t\,\mathrm{E}[J]$ and
 * $\mathrm{Var}[X(t)] = \lambda t\,\mathrm{E}[J^2]$.
 *
 * @class CompoundPoissonProcess
 * @memberof ran.process
 * @constructor
 */
export default class CompoundPoissonProcess extends Process {
  /**
   * @param {number} [lambda=1] Arrival rate (must be > 0).
   * @param {Object} jumpDist A `ran.dist` Distribution instance whose `.sample()` method supplies jump sizes.
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (lambda = 1, jumpDist, dt = 1) {
    super()
    Process.validate({ lambda, dt }, ['lambda > 0', 'dt > 0'])
    if (jumpDist == null || typeof jumpDist.sample !== 'function') {
      throw Error('Invalid parameters. jumpDist must be a ran.dist Distribution instance with a .sample() method.')
    }
    this.p = { lambda, jumpDist, dt }
    this.x = 0
    this.x0 = 0
    const meanJ = jumpDist.mean()
    // Pre-compute E[J] and E[J²] = Var[J] + E[J]² from the jump distribution's analytical moments.
    this.c = {
      meanJ,
      eJ2: jumpDist.variance() + meanJ * meanJ
    }
  }

  /**
   * Seeds both the arrival PRNG and the jump distribution for fully reproducible paths.
   *
   * @method seed
   * @memberof ran.process.CompoundPoissonProcess
   * @param {number|string} value Seed value.
   * @returns {this} Reference to the current process.
   */
  seed (value) {
    super.seed(value)
    // Seed jumpDist from this.r's post-warmup state so jump magnitudes are reproducible
    // but the two PRNGs produce independent streams (different initial states).
    this.p.jumpDist.seed(this.r.save()[0])
    return this
  }

  _next () {
    const k = poisson(this.r, this.p.lambda * this.p.dt)
    let sum = 0
    for (let i = 0; i < k; i++) {
      sum += this.p.jumpDist.sample()
    }
    return this.x + sum
  }

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    return this.p.lambda * t * this.c.meanJ
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    return this.p.lambda * t * this.c.eJ2
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    return this.p.lambda * this.c.eJ2 * Math.min(s, t)
  }
}
