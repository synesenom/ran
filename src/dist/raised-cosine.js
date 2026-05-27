import rejection from '../algorithms/rejection'
import Distribution from './_distribution'

/**
 * Probability function for the [raised cosine distribution]{@link https://en.wikipedia.org/wiki/Raised_cosine_distribution}:
 *
 * $f(x; \mu, s) = \frac{1}{2s} \Big\[1 + \cos\Big(\frac{x - \mu}{s} \pi\Big)\Big\],$
 *
 * where $\mu \in \mathbb{R}$ and $s > 0$. Support: $x \in \[\mu - s, \mu + s\]$.
 *
 * @class RaisedCosine
 * @memberof ran.dist
 * @constructor
 */
export default class RaisedCosine extends Distribution {
  /**
   * @param {number} mu Location paramter.
   * @param {number} s Scale parameter.
   */
  constructor (mu, s) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, s }
    Distribution.validate({ mu, s }, [
      's > 0'
    ])

    // Set support
    this.s = [{
      value: mu - s,
      closed: true
    }, {
      value: mu + s,
      closed: true
    }]
  }

  _generator () {
    // Rejection sampling with uniform distribution as major
    return rejection(
      this.r,
      () => this.p.mu - this.p.s + 2 * this.p.s * this.r.next(),
      x => {
        return 0.5 * (1 + Math.cos(Math.PI * (x - this.p.mu) / this.p.s))
      }
    )
  }

  _pdf (x) {
    return 0.5 * (1 + Math.cos(Math.PI * (x - this.p.mu) / this.p.s)) / this.p.s
  }

  _cdf (x) {
    const z = (x - this.p.mu) / this.p.s
    return 0.5 * (1 + z + Math.sin(Math.PI * z) / Math.PI)
  }
}
