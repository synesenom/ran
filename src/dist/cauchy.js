import Distribution from './_distribution'

/**
 * Generator for the [Cauchy distribution]{@link https://en.wikipedia.org/wiki/Cauchy_distribution}:
 *
 * $$f(x; x_0, \gamma) = \frac{1}{\pi\gamma\bigg[1 + \Big(\frac{x - x_0}{\gamma}\Big)^2\bigg]}$$
 *
 * where \(x_0 \in \mathbb{R}\) and \(\gamma > 0\). Support: \(x \in \mathbb{R}\).
 *
 * @class Cauchy
 * @memberOf ran.dist
 * @param {number=} x0 Location parameter. Default value is 0.
 * @param {number=} gamma Scale parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (x0 = 0, gamma = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { x0, gamma }
    Distribution._validate({ x0, gamma }, [
      'gamma > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      Math.PI * this.p.gamma
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (this.r.next() - 0.5)))
  }

  _pdf (x) {
    let y = (x - this.p.x0) / this.p.gamma
    return 1 / (this.c[0] * (1 + y * y))
  }

  _cdf (x) {
    return 0.5 + Math.atan2(x - this.p.x0, this.p.gamma) / Math.PI
  }

  _q (p) {
    return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (p - 0.5)))
  }
}
