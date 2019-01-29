import Distribution from './_distribution'

/**
 * Generator for the [Bernoulli distribution]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}:
 *
 * $$f(k; p) = \begin{cases}p &\quad\text{if $k = 1$},\\1 - p &\quad\text{if $k = 0$}\\\end{cases},$$
 *
 * where \(p \in [0, 1]\). Support: \(k \in \{0, 1\}\).
 *
 * @class Bernoulli
 * @memberOf ran.dist
 * @param {number=} p Probability of the outcome 1. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (p = 0.5) {
    super('discrete', arguments.length)
    this.p = { p }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling
    return Math.random() < this.p.p ? 1 : 0
  }

  _pdf (x) {
    return x === 1 ? this.p.p : x === 0 ? 1 - this.p.p : 0
  }

  _cdf () {
    return 1 - this.p.p
  }
}
