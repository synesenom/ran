import Gamma from './gamma'
import Distribution from './_distribution'

/**
 * Generator for the [Erlang distribution]{@link https://en.wikipedia.org/wiki/Erlang_distribution}:
 *
 * $$f(x; k, \lambda) = \frac{\lambda^k x^{k - 1} e^{-\lambda x}}{(k - 1)!},$$
 *
 * where $k \in \mathbb{N}^+$ and $\lambda > 0$. Support: $x \ge 0$.
 *
 * @class Erlang
 * @memberof ran.dist
 * @param {number=} k Shape parameter. It is rounded to the nearest integer. Default value is 1.
 * @param {number=} lambda Rate parameter. Default value is 1.
 * @constructor
 */
export default class extends Gamma {
  // Special case of gamma
  constructor (k = 1, lambda = 1) {
    const ki = Math.round(k)
    super(ki, lambda)

    // Validate parameters
    Distribution.validate({ k: ki, lambda }, [
      'k > 0',
      'lambda > 0'
    ])
  }
}
