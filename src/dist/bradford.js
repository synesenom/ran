import Distribution from './_distribution'

/**
 * Generator for the [Bradford distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bradford.html}:
 *
 * $f(x; c) = \frac{c}{\ln(1 + c) (1 + c x)},$
 *
 * with $c > 0$. Support: $x \in \[0, 1\]$.
 *
 * @class Bradford
 * @memberof ran.dist
 * @see https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bradford.html
 * @constructor
 */
export default class Bradford extends Distribution {
  /**
   * @param {number} c Shape parameter.
   */
  constructor (c) {
    super('continuous', 1)

    // Validate parameters
    this.p = { c }
    Distribution.validate({ c }, [
      'c > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]

    // Speed-up constants
    const log1pc = Math.log(1 + c)
    this.c = {
      log1pc,
      cOverLog1pc: c / log1pc
    }
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c.cOverLog1pc / (1 + this.p.c * x)
  }

  _cdf (x) {
    return Math.log(1 + this.p.c * x) / this.c.log1pc
  }

  _q (p) {
    return (Math.exp(this.c.log1pc * p) - 1) / this.p.c
  }
}
