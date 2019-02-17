import Distribution from './_distribution'

/**
 * Generator for the [Bradford distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_bradford.html}:
 *
 * $$f(x; c) = \frac{c}{\ln(1 + c) (1 + c x)},$$
 *
 * with \(c \in \mathbb{R}^+\). Support: \(x \in [0, 1]\).
 *
 * @class Bradford
 * @memberOf ran.dist
 * @param {number=} c Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (c = 1) {
    super('continuous', arguments.length)
    this.p = { c }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
    this.c = [
      Math.log(1 + c)
    ]
  }

  _generator () {
    // Inverse transform sampling
    return (Math.exp(this.c[0] * Math.random()) - 1) / this.p.c
  }

  _pdf (x) {
    return this.p.c / (this.c[0] * (1 + this.p.c * x))
  }

  _cdf (x) {
    return Math.log(1 + this.p.c * x) / this.c[0]
  }
}
