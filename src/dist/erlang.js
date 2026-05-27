import Gamma from './gamma'
import Distribution from './_distribution'

/**
 * Probability function for the [Erlang distribution]{@link https://en.wikipedia.org/wiki/Erlang_distribution}:
 *
 * $f(x; k, \lambda) = \frac{\lambda^k x^{k - 1} e^{-\lambda x}}{(k - 1)!},$
 *
 * where $k \in \mathbb{N}^+$ and $\lambda > 0$. Support: $x \ge 0$.
 *
 * @class Erlang
 * @memberof ran.dist
 * @constructor
 */
export default class Erlang extends Gamma {
  // Special case of gamma
  /**
   * @param {number} k Shape parameter. It is rounded to the nearest integer.
   * @param {number} lambda Rate parameter.
   */
  constructor (k, lambda) {
    const ki = Math.round(k)
    super(ki, lambda)

    // Validate parameters
    Distribution.validate({ k: ki, lambda }, [
      'k > 0',
      'lambda > 0'
    ])
  }
}
