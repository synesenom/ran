import Distribution from './_distribution'

/**
 * Probability density function for the [Laplace distribution]{@link https://en.wikipedia.org/wiki/Laplace_distribution} (also known as double exponential distribution):
 *
 * $f(x; \mu, b) = \frac{1}{2b}e^{-\frac{|x - \mu|}{b}},$
 *
 * where $\mu \in \mathbb{R}$ and $b > 0$. Support: $x \in \mathbb{R}$.
 *
 * Cumulative distribution function:
 *
 * $F(x; \mu, b) = \begin{cases} \tfrac{1}{2} e^{(x-\mu)/b} & x < \mu \\ 1 - \tfrac{1}{2} e^{-(x-\mu)/b} & x \ge \mu \end{cases}$
 *
 * @class Laplace
 * @memberof ran.dist
 * @constructor
 */
export default class Laplace extends Distribution {
  /**
   * @param {number} mu Location parameter.
   * @param {number} b Scale parameter.
   */
  constructor (mu, b) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, b }
    Distribution.validate({ mu, b }, [
      'b > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling from uniform
    return this.p.mu + this.p.b * Math.log(this.r.next() / this.r.next())
  }

  _pdf (x) {
    return 0.5 * Math.exp(-Math.abs(x - this.p.mu) / this.p.b) / this.p.b
  }

  _cdf (x) {
    const z = Math.exp((x - this.p.mu) / this.p.b)
    return x < this.p.mu ? 0.5 * z : 1 - 0.5 / z
  }

  _q (p) {
    return p < 0.5
      ? this.p.mu + this.p.b * Math.log(2 * p)
      : this.p.mu - this.p.b * Math.log(2 - 2 * p)
  }

  static get _fitInitIsExact () {
    // _fitInit returns the exact closed-form MLE, so fit() skips the optimizer (ADR-0016).
    return true
  }

  static _fitInit (data) {
    // MLE for Laplace is closed-form: mu = sample median, b = mean absolute deviation from the median
    const sorted = data.slice().sort((a, b) => a - b)
    const n = sorted.length
    const mu = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    const b = data.reduce((s, x) => s + Math.abs(x - mu), 0) / n || 1
    return [mu, b]
  }
}
