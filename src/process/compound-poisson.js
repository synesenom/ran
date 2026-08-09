import poisson from '../dist/_poisson'
import Gamma from '../dist/gamma'
import Tweedie from '../dist/tweedie'
import Process from './_process'

// Broken out of fit() to keep it under CodeScene's cyclomatic-complexity gate.
function recoverJumps (path) {
  const jumps = []
  for (let i = 1; i < path.length; i++) {
    const d = path[i] - path[i - 1]
    if (d !== 0) jumps.push(d)
  }
  return jumps
}

function validateFitArgs (path, jumpDistConstructor) {
  if (!Array.isArray(path) || path.length < 2) {
    throw Error('CompoundPoisson.fit(): path must contain at least 2 states')
  }
  if (jumpDistConstructor == null || typeof jumpDistConstructor.fit !== 'function') {
    throw Error('CompoundPoisson.fit(): jumpDistConstructor must be a ran.dist Distribution class with a static fit() method')
  }
}

/**
 * Compound Poisson process: cumulative random-magnitude jumps arriving at a Poisson rate.
 *
 * At each time step of width $\mathrm{d}t$ the state advances by the sum of
 * $K \sim \mathrm{Poisson}(\lambda\,\mathrm{d}t)$ independent jumps drawn from
 * the supplied distribution:
 *
 * $X_{t+\mathrm{d}t} = X_t + \sum_{i=1}^{K} J_i,$
 *
 * where $K \sim \mathrm{Poisson}(\lambda\,\mathrm{d}t)$ and $J_i \sim \text{jumpDist}$.
 *
 * Unlike the other processes in this module, `marginal(t)` is unsupported for a general
 * `jumpDist`: because `jumpDist` is an arbitrary caller-supplied `ran.dist` instance, $X_t$ is a
 * Poisson mixture over sums of an unknown distribution, which has no general closed form
 * reducible to a single existing `ran.dist` class. The one documented exception is Gamma-
 * distributed jumps, whose mixture is by definition the compound Poisson-gamma total that
 * `ran.dist.Tweedie` already represents (see `marginal()` below for the parameter mapping).
 *
 * @class CompoundPoisson
 * @memberof ran.process
 * @constructor
 */
export default class CompoundPoisson extends Process {
  /**
   * @param {Object} jumpDist A `ran.dist` Distribution instance whose `.sample()` method supplies jump sizes.
   * @param {number} lambda Arrival rate (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (jumpDist, lambda, dt = 1) {
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

  /** @inheritdoc */
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

  /**
   * Returns the marginal distribution of $X_t$ when `jumpDist` is a `ran.dist.Gamma` instance,
   * and throws for every other `jumpDist`. $X_t$ is by definition $\sum_{i=1}^{N} J_i$ with
   * $N \sim \mathrm{Poisson}(\lambda t)$ and $J_i \sim \mathrm{Gamma}(\alpha, \beta)$ (shape,
   * rate) — exactly the compound Poisson-gamma total `ran.dist.Tweedie` represents as
   * $\mathrm{Tweedie}(\mu, \phi, p)$, so no new special function or Distribution subclass is
   * needed. The mapping is derived by matching the two representations' Poisson rate and gamma
   * shape/rate:
   *
   * $p = \frac{\alpha + 2}{\alpha + 1}, \qquad \mu = \frac{\lambda t \alpha}{\beta}, \qquad
   * \phi = \frac{\alpha + 1}{\beta\, \mu^{1 / (\alpha + 1)}}.$
   *
   * No other jump distribution admits a closed form reducible to an existing `ran.dist` class
   * (arbitrary `jumpDist` makes $X_t$ a Poisson mixture over an unknown distribution's sums);
   * adding another allowed case would require new distribution machinery and must be scoped as
   * a separate prerequisite issue (CLAUDE.md "Prerequisite extraction").
   *
   * @method marginal
   * @memberof ran.process.CompoundPoisson
   * @param {number} t Time.
   * @returns {import('../dist/_distribution').default} A `Tweedie` instance when `jumpDist` is `Gamma`.
   * @throws {Error} If `t <= 0`, or if `jumpDist` is not a `ran.dist.Gamma` instance.
   * @ignore
   */
  marginal (t) {
    if (t <= 0) {
      throw Error('CompoundPoisson.marginal(): t must be > 0')
    }
    const { jumpDist, lambda } = this.p
    if (!(jumpDist instanceof Gamma)) {
      throw Error('CompoundPoisson.marginal(): no closed form exists for an arbitrary jump distribution; only Gamma-distributed jumps are supported')
    }
    const { alpha, beta } = jumpDist.params()
    const lambdaT = lambda * t
    const mu = lambdaT * alpha / beta
    const p = (alpha + 2) / (alpha + 1)
    const phi = (alpha + 1) / (beta * Math.pow(mu, 1 / (alpha + 1)))
    return new Tweedie(mu, phi, p)
  }

  /**
   * Estimates lambda and the jump distribution's parameters from an observed path. Individual
   * arrival counts within a single dt interval are not observable from the cumulative path —
   * only the net increment is — so this estimator treats every non-zero increment as exactly
   * one jump, the same simplification standard for compound Poisson estimation when lambda*dt
   * is small enough that multi-jump intervals are rare. Under that reading, lambda reduces to
   * the same count/time MLE as Poisson.fit() (the number of non-zero increments divided by the
   * total observed time), and the non-zero increments themselves are the recovered jump sizes,
   * handed to jumpDistConstructor's own static fit().
   *
   * @method fit
   * @memberof ran.process.CompoundPoisson
   * @param {Array} path Array of observed states (as returned by path()).
   * @param {number} [dt=1] Time step between consecutive path observations (must be > 0).
   * @param {Function} [jumpDistConstructor] A `ran.dist` Distribution class with a static `fit()` method, used to fit the recovered jump sizes. Required at runtime (throws if omitted); optional here only so the generated TypeScript signature stays assignable to `Process.fit`'s `(path, dt?)`.
   * @returns {CompoundPoisson} A new instance with estimated lambda and a fitted jumpDist.
   * @throws {Error} If path has fewer than 2 states, if dt is not > 0, if jumpDistConstructor
   * does not expose a static fit() method, or if the path contains no non-zero increments to
   * recover jump sizes from.
   * @ignore
   */
  static fit (path, dt = 1, jumpDistConstructor) {
    Process.validate({ dt }, ['dt > 0'])
    validateFitArgs(path, jumpDistConstructor)
    const jumps = recoverJumps(path)
    if (jumps.length === 0) {
      throw Error('CompoundPoisson.fit(): path contains no non-zero increments to recover jump sizes from')
    }
    const lambda = jumps.length / ((path.length - 1) * dt)
    const Cls = this
    return new Cls(jumpDistConstructor.fit(jumps), lambda, dt)
  }
}
