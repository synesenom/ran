import Distribution from './_distribution'

/**
 * Probability mass function for the [Rademacher distribution]{@link https://en.wikipedia.org/wiki/Rademacher_distribution}:
 *
 * $$f(k) = \begin{cases}1/2 &\quad\text{if $k = -1$},\\\\ 1/2 &\quad\text{if $k = 1$},\\\\ 0 &\quad\text{otherwise}.\\\\ \end{cases}$$
 *
 * Support: $k \in \{-1, 1\}$.
 *
 * @class Rademacher
 * @memberof ran.dist
 * @constructor
 */
export default class Rademacher extends Distribution {
  /** */
  constructor () {
    super('discrete', 0)
    this.s = [{
      value: -1,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
  }

  _generator () {
    return this.r.next() < 0.5 ? -1 : 1
  }

  _pdf (x) {
    return x === -1 || x === 1 ? 0.5 : 0
  }

  _cdf (x) {
    if (x < -1) return 0
    if (x < 1) return 0.5
    return 1
  }

  _q (p) {
    return p > 0.5 ? 1 : -1
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return 0
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return 1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return -2
  }
}
