import logGamma from '../special/log-gamma'
import ShiftedBinomial from '../dist/_shifted-binomial'
import Process from './_process'

/**
 * Fraction of +1 steps among an observed path's increments, i.e. the exact MLE for p.
 *
 * @param {Array} path Array of observed states.
 * @returns {number} Fraction of +1 steps.
 * @throws {Error} If any step is not +1 or -1.
 * @ignore
 */
function upFraction (path) {
  const n = path.length - 1
  let ups = 0
  for (let i = 0; i < n; i++) {
    const step = path[i + 1] - path[i]
    if (step === 1) {
      ups++
    } else if (step !== -1) {
      throw Error('RandomWalk.fit(): path contains a step that is not +1 or -1')
    }
  }
  return ups / n
}

/**
 * Discrete-time random walk on the integers: at each step the state moves by +1 with
 * probability p and by −1 with probability 1 − p. For p = 0.5 the walk is symmetric
 * (unbiased); for p ≠ 0.5 it has drift 2p − 1 per step.
 *
 * The update rule is
 *
 * $X_{n+1} = X_n + \begin{cases} +1 & \text{if } U < p, \\ -1 & \text{if } U \geq p, \end{cases}$
 *
 * where $U \sim \mathrm{Uniform}(0,1)$.
 *
 * @class RandomWalk
 * @memberof ran.process
 * @constructor
 */
export default class RandomWalk extends Process {
  /**
   * @param {number} p Probability of a +1 step (must satisfy 0 < p < 1).
   */
  constructor (p) {
    super()
    Process.validate({ p }, ['p > 0', 'p < 1'])
    this.p = { p }
    this.x = 0
    this.x0 = 0
  }

  _next () {
    return this.x + (this.r.next() < this.p.p ? 1 : -1)
  }

  /** @inheritdoc */
  mean (t) {
    if (t < 0) return NaN
    return t * (2 * this.p.p - 1)
  }

  /** @inheritdoc */
  variance (t) {
    if (t < 0) return NaN
    return 4 * this.p.p * (1 - this.p.p) * t
  }

  /** @inheritdoc */
  pdf (x, t) {
    if (t < 0 || !Number.isInteger(t)) return NaN
    // x must be an integer, reachable in t steps, and have the same parity as t
    if (!Number.isInteger(x) || Math.abs(x) > t || (t + x) % 2 !== 0) return 0
    // P(X_t = x) = Binomial(t, k, p) where k = (t + x) / 2 up-steps occurred
    const k = (t + x) / 2
    const { p } = this.p
    return Math.exp(logGamma(t + 1) - logGamma(k + 1) - logGamma(t - k + 1) + k * Math.log(p) + (t - k) * Math.log(1 - p))
  }

  /** @inheritdoc */
  covariogram (s, t) {
    if (s < 0 || t < 0) return NaN
    return 4 * this.p.p * (1 - this.p.p) * Math.min(s, t)
  }

  /** @inheritdoc */
  marginal (t) {
    if (t < 0 || !Number.isInteger(t)) {
      throw Error('RandomWalk.marginal(): t must be a non-negative integer')
    }
    return new ShiftedBinomial(t, this.p.p)
  }

  /**
   * Estimates p from an observed path as the exact MLE: the fraction of +1 steps among all
   * observed increments. Since every increment is exactly +1 or -1, this coincides with
   * recovering p from the sample mean of increments (mean = 2p-1, so p = (mean+1)/2) — the two
   * are algebraically identical, not two competing estimators.
   *
   * @method fit
   * @memberof ran.process.RandomWalk
   * @param {Array} path Array of observed states (as returned by path()).
   * @returns {RandomWalk} A new instance with estimated p.
   * @throws {Error} If path has fewer than 2 states, if any step is not +1 or -1, or if the
   * estimated p falls outside (0,1) (path contains only up-steps or only down-steps).
   */
  static fit (path) {
    if (!Array.isArray(path) || path.length < 2) {
      throw Error('RandomWalk.fit(): path must contain at least 2 states')
    }
    const p = upFraction(path)
    if (!(p > 0 && p < 1)) {
      throw Error('RandomWalk.fit(): estimated p is out of (0,1); path contains only up-steps or only down-steps')
    }
    return new RandomWalk(p)
  }
}
