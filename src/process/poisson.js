import poisson from '../dist/_poisson'
import PoissonDistribution from '../dist/poisson'
import logGamma from '../special/log-gamma'
import Process from './_process'

// A counting-process path must never decrease; broken out of fit() to keep it under
// CodeScene's cyclomatic-complexity gate.
function isNonDecreasing (path) {
  for (let i = 1; i < path.length; i++) {
    if (path[i] < path[i - 1]) return false
  }
  return true
}

/**
 * Poisson process: a counting process of independent arrivals at rate $\lambda$, using an exact
 * discrete-time sampler.
 *
 * By the independent-increments property, the number of arrivals in any interval of length
 * $\mathrm{d}t$ is exactly $\mathrm{Poisson}(\lambda \mathrm{d}t)$, independent of all other
 * intervals. The sampler draws that count directly
 *
 * $X_{t+\mathrm{d}t} = X_t + K, \quad K \sim \mathrm{Poisson}(\lambda\,\mathrm{d}t),$
 *
 * with no step-size discretization error.
 *
 * @class Poisson
 * @memberof ran.process
 * @constructor
 */
export default class Poisson extends Process {
  /**
   * @param {number} lambda Event rate (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (lambda, dt = 1) {
    super()
    Process.validate({ lambda, dt }, ['lambda > 0', 'dt > 0'])
    this.p = { lambda, dt }
    this.x = 0
    this.x0 = 0
  }

  _next () {
    return this.x + poisson(this.r, this.p.lambda * this.p.dt)
  }

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    return this.p.lambda * t
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    return this.p.lambda * t
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t < 0) return NaN
    if (!Number.isInteger(x) || x < 0) return 0
    if (t === 0) return x === 0 ? 1 : 0
    const lt = this.p.lambda * t
    return Math.exp(-lt + x * Math.log(lt) - logGamma(x + 1))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    return this.p.lambda * Math.min(s, t)
  }

  /** @inheritdoc */
  marginal (t) {
    if (t <= 0) {
      throw Error('Poisson.marginal(): t must be > 0')
    }
    return new PoissonDistribution(this.p.lambda * t)
  }

  /**
   * Estimates lambda from an observed path via the exact MLE: the total arrival count
   * (the path's net increase) divided by the total observed time, since increments are
   * i.i.d. Poisson(lambda*dt) by the independent-increments property _next() already
   * relies on.
   *
   * @method fit
   * @memberof ran.process.Poisson
   * @param {Array} path Array of observed states (as returned by path()).
   * @param {number} [dt=1] Time step between consecutive path observations (must be > 0).
   * @returns {Poisson} A new instance with estimated lambda.
   * @throws {Error} If path has fewer than 2 states, if dt is not > 0, if the path
   * decreases anywhere, or if the estimated lambda is not positive (no arrivals observed).
   */
  static fit (path, dt = 1) {
    Process.validate({ dt }, ['dt > 0'])
    if (!Array.isArray(path) || path.length < 2) {
      throw Error('Poisson.fit(): path must contain at least 2 states')
    }
    if (!isNonDecreasing(path)) {
      throw Error('Poisson.fit(): path must be non-decreasing')
    }
    const n = path.length - 1
    const lambda = (path[n] - path[0]) / (n * dt)
    if (!(lambda > 0)) {
      throw Error('Poisson.fit(): estimated lambda is not positive; path shows no arrivals')
    }
    const Cls = this
    return new Cls(lambda, dt)
  }
}
