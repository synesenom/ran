import logGamma from '../special/log-gamma'
import Process from './_process'

/**
 * Discrete-time random walk on the integers: at each step the state moves by +1 with
 * probability p and by −1 with probability 1 − p. For p = 0.5 the walk is symmetric
 * (unbiased); for p ≠ 0.5 it has drift 2p − 1 per step.
 *
 * The update rule is
 *
 * $X_{n+1} = X_n + \begin{cases} +1 &\quad\text{if $U < p$, \\ -1 &\quad\text{if $U \geq p$}, \end{cases},$
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
}
