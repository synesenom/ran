import { generalizedHarmonic, riemannZeta } from '../special'
import zeta from './_zeta'
import Distribution from './_distribution'

/**
 * Probability mass function for the [zeta distribution]{@link https://en.wikipedia.org/wiki/Zeta_distribution}:
 *
 * $f(k; s) = \frac{k^{-s}}{\zeta(s)},$
 *
 * with $s \in (1, \infty)$ and $\zeta(x)$ is the Riemann zeta function. Support: $k \in \mathbb{N}^+$.
 *
 * Cumulative distribution function:
 *
 * $F(k; s) = \frac{H(k, s)}{\zeta(s)}$
 *
 * where $H(k, s) = \sum_{i=1}^{k} i^{-s}$ is the generalized harmonic number.
 *
 * @class Zeta
 * @memberof ran.dist
 * @see L. Devroye, "Non-Uniform Random Variate Generation", Springer-Verlag, 1986, ch. 10.
 * @constructor
 */
export default class Zeta extends Distribution {
  /**
   * @param {number} s Exponent of the distribution.
   */
  constructor (s) {
    super('discrete', 1)

    // Validate parameters
    this.p = { s }
    Distribution.validate({ s }, [
      's > 1'
    ])

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      zetaS: riemannZeta(s),
      pow2sm1: Math.pow(2, s - 1)
    }
  }

  static _fitInit (data) {
    // Hill estimator gives MLE for the power-law exponent on integer support starting at 1.
    const sumLog = data.reduce((s, x) => s + Math.log(x), 0)
    return [sumLog <= 0 ? 2 : Math.max(1.01, Math.min(100, 1 + data.length / sumLog))]
  }

  _generator () {
    // Rejection sampling
    return zeta(this.r, this.p.s)
  }

  _pdf (x) {
    return Math.pow(x, -this.p.s) / this.c.zetaS
  }

  _cdf (x) {
    return generalizedHarmonic(x, this.p.s) / this.c.zetaS
  }
}
