import Normal from './normal'
import Distribution from './_distribution'
import { erfinv } from '../special'

/**
 * Generator for [Johnson's $S_B$ distribution]{@link https://en.wikipedia.org/wiki/Johnson%27s_SU-distribution#Johnson's_SB-distribution}:
 *
 * $f(x; \gamma, \delta, \lambda, \xi) = \frac{\delta \lambda}{\sqrt{2 \pi} z (\lambda - z)} e^{-\frac{1}{2}\big\[\gamma + \delta \ln \frac{z}{\lambda - z}\big\]^2},$
 *
 * with $\gamma, \xi \in \mathbb{R}$, $\delta, \lambda > 0$ and $z = x - \xi$. Support: $x \in (\xi, \xi + \lambda)$.
 *
 * @class JohnsonSB
 * @memberof ran.dist
 * @constructor
 */
export default class JohnsonSB extends Normal {
  // Transformation of normal distribution
  /**
   * @param {number} gamma First location parameter.
   * @param {number} delta First scale parameter.
   * @param {number} lambda Second scale parameter.
   * @param {number} xi Second location parameter.
   */
  constructor (gamma, delta, lambda, xi) {
    super(0, 1)

    // Validate parameters
    this.p = Object.assign(this.p, { gamma, delta, lambda, xi })
    Distribution.validate({ gamma, delta, lambda, xi }, [
      'delta > 0',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: xi,
      closed: true
    }, {
      value: xi + lambda,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return this.p.xi + this.p.lambda / (1 + Math.exp(-(super._generator() - this.p.gamma) / this.p.delta))
  }

  _pdf (x) {
    const z = x - this.p.xi
    return this.p.delta * this.p.lambda * super._pdf(this.p.gamma + this.p.delta * Math.log(z / (this.p.lambda - z))) / (z * (this.p.lambda - z))
  }

  _cdf (x) {
    const z = x - this.p.xi
    const lnz = Math.log(z / (this.p.lambda - z))
    return Number.isFinite(lnz) ? super._cdf(this.p.gamma + this.p.delta * lnz) : 0
  }

  _q (p) {
    return this.p.xi + this.p.lambda / (1 + Math.exp(-(this.c.sigmaRoot2 * erfinv(2 * p - 1) - this.p.gamma) / this.p.delta))
  }
}
