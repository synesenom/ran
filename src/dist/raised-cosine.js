import { normal, rejection } from './_core'
import Distribution from './_distribution'

/**
 * Generator for the [raised cosine distribution]{@link https://en.wikipedia.org/wiki/Raised_cosine_distribution}:
 *
 * $$f(x; \mu, s) = \frac{1}{2s} \Big[1 + \cos\Big(\frac{x - \mu}{s} \pi\Big)\Big],$$
 *
 * where \(\mu \in \mathbb{R}\) and \(s \in \mathbb{R}^+\). Support: \(x \in [\mu - s, \mu + s]\).
 *
 * @class RaisedCosine
 * @memberOf ran.dist
 * @param {number=} mu Location paramter. Default value is 0.
 * @param {number=} s Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (mu = 0, s = 1) {
    super('continuous', arguments.length)
    this.p = { mu, s }
    this.s = [{
      value: mu - s,
      closed: true
    }, {
      value: mu + s,
      closed: true
    }]
  }

  _generator () {
    // Rejection sampling with normal(mu, s) distribution as major
    return rejection(
      () => {
        // Sample normal variate within support
        let x = normal(this.p.mu, this.p.s)
        while (x < this.p.mu - this.p.s || x > this.p.mu + this.p.s) {
          x = normal(this.p.mu, this.p.s)
        }
        return x
      },
      x => {
        let z = (x - this.p.mu) / this.p.s
        return 0.5 * (1 + Math.cos(Math.PI * z) * Math.exp(0.5 * z * z))
      }
    )
  }

  _pdf (x) {
    return 0.5 * (1 + Math.cos(Math.PI * (x - this.p.mu) / this.p.s)) / this.p.s
  }

  _cdf (x) {
    let z = (x - this.p.mu) / this.p.s
    return 0.5 * (1 + z + Math.sin(Math.PI * z) / Math.PI)
  }
}
