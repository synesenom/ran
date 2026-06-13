import Distribution from './_distribution'
import { riemannZeta } from '../special'

/**
 * Probability density function for the [half-logistic distribution]{@link https://en.wikipedia.org/wiki/Half-logistic_distribution}:
 *
 * $$f(x) = \frac{2 e^{-x}}{(1 + e^{-x})^2}.$$
 *
 * Support: $x \in [0, \infty)$.
 *
 * @class HalfLogistic
 * @memberof ran.dist
 * @constructor
 */
export default class HalfLogistic extends Distribution {
  /** */
  constructor () {
    super('continuous', 0)

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.exp(-x)
    return 2 * y / Math.pow(1 + y, 2)
  }

  _cdf (x) {
    // tanh(x/2) = (1-exp(-x))/(1+exp(-x)) avoids cancellation near x=0
    return Math.tanh(x / 2)
  }

  _q (p) {
    return -Math.log((1 - p) / (1 + p))
  }

  /**
   * @returns {number} The mean, $\ln 4$.
   */
  mean () {
    return 2 * Math.LN2
  }

  /**
   * @returns {number} The variance, $\frac{\pi^2}{3} - 4\ln^2 2$.
   */
  variance () {
    return Math.PI * Math.PI / 3 - 4 * Math.LN2 * Math.LN2
  }

  /**
   * @returns {number} The skewness via $E[X^k] = 2k!(1-2^{1-k})\zeta(k)$.
   */
  skewness () {
    // E[X^k] = 2·k!·(1 − 2^{1−k})·ζ(k) from the half-logistic series expansion
    const l2 = Math.LN2
    const pi2 = Math.PI * Math.PI
    const z3 = riemannZeta(3)
    const m1 = 2 * l2
    const m2 = pi2 / 3
    const m3 = 9 * z3
    const v = m2 - m1 * m1
    return (m3 - 3 * m1 * m2 + 2 * m1 * m1 * m1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis via $E[X^4] = \frac{7\pi^4}{15}$.
   */
  kurtosis () {
    const l2 = Math.LN2
    const pi2 = Math.PI * Math.PI
    const z3 = riemannZeta(3)
    const m1 = 2 * l2
    const m2 = pi2 / 3
    const m3 = 9 * z3
    const m4 = 7 * pi2 * pi2 / 15
    const v = m2 - m1 * m1
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 * m1 * m1 * m1) / (v * v) - 3
  }
}
