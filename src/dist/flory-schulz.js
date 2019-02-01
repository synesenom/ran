import { lambertW } from '../special'
import Distribution from './_distribution'

/**
 * Generator for the [Flory-Schulz distribution]{@link https://en.wikipedia.org/wiki/Flory%E2%80%93Schulz_distribution}:
 *
 * $$f(k; a) = a^2 k (1 - a)^{k - 1},$$
 *
 * with \(a \in (0, 1)\). Support: \(k \in \mathbb{N}^+\).
 *
 * @class FlorySchulz
 * @memberOf ran.dist
 * @param {number=} a Shape parameter. Default value is 0.5.
 * @constructor
 */
export default class extends Distribution {
  constructor (a = 0.5) {
    super('discrete', arguments.length)
    this.p = { a }
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: null,
      closed: true
    }]
  }

  _generator () {
    let c = Math.log(1 - this.p.a) / this.p.a
    return Math.floor((lambertW(c * Math.exp(c) * Math.random()) / c - 1) / this.p.a)
  }

  _pdf (x) {
    return this.p.a * this.p.a * x * Math.pow(1 - this.p.a, x - 1)
  }

  _cdf (x) {
    return 1 - Math.pow(1 - this.p.a, x) * (1 + this.p.a * x)
  }
}
