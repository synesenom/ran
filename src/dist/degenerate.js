import Distribution from './_distribution'

/**
 * Probability density function for the [degenerate distribution]{@link https://en.wikipedia.org/wiki/Degenerate_distribution}:
 *
 * $f(x; x_0) = \begin{cases}1 &\quad\text{if $x = x_0$}\\\\0 &\quad\text{otherwise}\\\\\\end{cases},$
 *
 * where $x_0 \in \mathbb{R}$. Support: $x \in \mathbb{R}$.
 *
 * Cumulative distribution function:
 *
 * $F(x; x_0) = \begin{cases} 0 & x < x_0 \\ 1 & x \ge x_0 \end{cases}$
 *
 * @class Degenerate
 * @memberof ran.dist
 * @constructor
 */
export default class Degenerate extends Distribution {
  /**
   * @param {number} x0 Location of the distribution.
   */
  constructor (x0) {
    super('continuous', 1)

    // Validate parameters
    this.p = { x0 }
    Distribution.validate({ x0 }, [])

    this.s = [{
      value: x0,
      closed: true
    }, {
      value: x0,
      closed: true
    }]
  }

  static _fitInit (data) {
    // All mass sits at a single point; the sample mean is the natural location estimate
    return [data.reduce((s, x) => s + x, 0) / data.length]
  }

  _generator () {
    // Direct sampling
    return this.p.x0
  }

  _pdf () {
    return 1
  }
}
