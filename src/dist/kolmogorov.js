import Distribution from './_distribution'
import { EPS, MAX_ITER } from '../core/constants'

/**
 * Generator for the [Kolmogorov distribution]{@link https://en.wikipedia.org/wiki/Kolmogorov%E2%80%93Smirnov_test#Kolmogorov_distribution}:
 *
 * $$f(x) = 8 \sum_{k=1}^\infty (-1)^{k - 1} k^2 x e^{-2 k^2 x^2}.$$
 *
 * Support: $x > 0$.
 *
 * @class Kolmogorov
 * @memberof ran.dist
 * @constructor
 */
export default class Davis extends Distribution {
  constructor () {
    super('continuous', arguments.length)

    // Set support.
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    return this.q(this.r.next())
  }

  _pdf (x) {
    let y = 0
    for (let k = 0; k < MAX_ITER; k++) {
      const dy = (k % 2 === 0 ? 1 : -1) * k**2 * x * Math.exp(-2 * (k * x)**2)
      y += dy
      if (Math.abs(dy) < EPS * Math.abs(y)) {
        return -8 * y
      }
    }
    return -8 * y
  }

  _cdf (x) {
    let y = 0
    for (let k = 1; k < MAX_ITER; k++) {
      const dy = (k % 2 === 0 ? 1 : -1) * Math.exp(-2 * (k * x)**2)
      y += dy
      if (Math.abs(dy) < EPS * Math.abs(y)) {
        return 1 + 2 * y
      }
    }
    return 1 + 2 * y
  }
}
