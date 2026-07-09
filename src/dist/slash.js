import { erf } from '../special'
import normal from './_normal'
import Normal from './normal'

/**
 * Probability density function for the [slash distribution]{@link https://en.wikipedia.org/wiki/Slash_distribution}:
 *
 * $f(x) = \begin{cases}\frac{\phi(0) - \phi(x)}{x^2} &\quad\text{if $x \ne 0$},\\\\ \frac{1}{2 \sqrt{2 \pi}} &\quad\text{if $x = 0$}\\\\ \end{cases},$
 *
 * where $\phi(x)$ is the probability density function of the standard [normal distribution]{@link #dist.Normal}.
 * Support: $x \in \mathbb{R}$.
 *
 * @class Slash
 * @memberof ran.dist
 * @constructor
 */
export default class Slash extends Normal {
  /** */
  constructor () {
    super(0, 1)

    // Slash has no free parameters; override the 2 inherited from Normal
    this.k = 0

    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p
    this.p = {}
    // this.c.sigmaRoot2Pi = sqrt(2π), this.c.sigmaRoot2 = sqrt(2) set by Normal constructor
    Object.assign(this.c, { halfOverRoot2Pi: 0.5 / Math.sqrt(2 * Math.PI) })
  }

  _generator () {
    // Direct sampling by the ratio of normal and uniform variates
    return normal(this.r, 0, 1) / this.r.next()
  }

  _pdf (x) {
    return x === 0
      ? this.c.halfOverRoot2Pi
      : (1 - Math.exp(-0.5 * x * x)) / (x * x * this.c.sigmaRoot2Pi)
  }

  _cdf (x) {
    return x === 0
      ? 0.5
      : 0.5 * (1 + erf(x / this.c.sigmaRoot2)) - (1 - Math.exp(-0.5 * x * x)) / (x * this.c.sigmaRoot2Pi)
  }

  _q (p) {
    return this._qEstimateRoot(p)
  }

  /**
   * @returns {number} NaN (mean does not exist for the Slash distribution — E[|X|] diverges, same as Cauchy).
   */
  mean () {
    return NaN
  }

  /**
   * @returns {number} NaN (variance does not exist for the Slash distribution — Slash tails decay as 1/x², same as Cauchy, so E[|X|] diverges and all moments are undefined).
   */
  variance () {
    return NaN
  }

  /**
   * @returns {number} Skewness of the distribution (undefined for Slash).
   */
  skewness () {
    return NaN
  }

  /**
   * @returns {number} Excess kurtosis of the distribution (undefined for Slash).
   */
  kurtosis () {
    return NaN
  }
}
