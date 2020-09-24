import Distribution from './_distribution'

/**
 * Generator for the [degenerate distribution]{@link https://en.wikipedia.org/wiki/Degenerate_distribution}:
 *
 * $$f(x; x_0) = \begin{cases}1 &\quad\text{if $x = x_0$}\\0 &\quad\text{otherwise}\\\end{cases},$$
 *
 * where \(x_0 \in \mathbb{R}\). Support: \(x \in \mathbb{R}\).
 *
 * @class Degenerate
 * @memberof ran.dist
 * @param {number=} x0 Location of the distribution. Default value is 0.
 * @constructor
 */
export default class extends Distribution {
  constructor (x0 = 0) {
    super('continuous', arguments.length)
    this.p = { x0 }
    this.s = [{
      value: x0,
      closed: true
    }, {
      value: x0,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling
    return this.p.x0
  }

  _pdf () {
    return 1
  }
}
