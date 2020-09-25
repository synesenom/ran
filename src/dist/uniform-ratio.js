import Distribution from './_distribution'

// TODO Docs
/**
 * Generator for the [uniform ratio distribution]{@link https://en.wikipedia.org/wiki/Ratio_distribution#Uniform_ratio_distribution}:
 *
 * $$f(x) = \begin{cases}\frac{1}{2} &\quad\text{if $x < 1$},\\\\ \frac{1}{2x^2} &\quad\text{if $x \ge 1$},\\\\ \end{cases}.$$
 *
 * Support: $x > 0$.
 *
 * @class UniformRatio
 * @memberof ran.dist
 * @constructor
 */
export default class extends Distribution {
  constructor () {
    super('continuous', arguments.length)

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    return this.r.next() / this.r.next()
  }

  _pdf (x) {
    return x <= 1 ? 0.5 : 0.5 / (x * x)
  }

  _cdf (x) {
    return x <= 1 ? 0.5 * x : 1 - 0.5 / x
  }

  _q (p) {
    return p <= 0.5 ? 2 * p : 0.5 / (1 - p)
  }
}
