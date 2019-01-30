import Distribution from './_distribution'

/**
 * Generator for the [Rademacher distribution]{@link https://en.wikipedia.org/wiki/Rademacher_distribution}:
 *
 * $$f(k) = \begin{cases}1/2 &\quad\text{if $k = -1$},\\1/2 &\quad\text{if $k = 1$},\\0 &\quad\text{otherwise}.\\\end{cases}$$
 *
 * Support: \(k \in \{-1, 1\}\).
 *
 * @class Rademacher
 * @memberOf ran.dist
 * @constructor
 */
export default class extends Distribution {
  constructor () {
    super('discrete', arguments.length)
    this.s = [{
      value: -1,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling
    return Math.random() > 0.5 ? -1 : 1
  }

  _pdf (x) {
    return x === -1 || x === 1 ? 0.5 : 0
  }

  _cdf (x) {
    return x < -1 ? 0 : x >= 1 ? 1 : 0.5
  }
}
