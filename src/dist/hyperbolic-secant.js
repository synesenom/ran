import Distribution from './_distribution'

/**
 * Generator for the [hyperbolic secant distribution]{@link https://en.wikipedia.org/wiki/Hyperbolic_secant_distribution}:
 *
 * $$f(x) = \frac{1}{2}\mathrm{sech}\Big(\frac{\pi}{2} x\Big).$$
 *
 * Support: \(x \in \mathbb{R}\).
 *
 * @class HyperbolicSecant
 * @memberOf ran.dist
 * @constructor
 */
export default class extends Distribution {
  constructor () {
    super('continuous', arguments.length)
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    return 2 * Math.log(Math.tan(0.5 * Math.PI * this.r.next())) / Math.PI
  }

  _pdf (x) {
    return 0.5 / Math.cosh(0.5 * Math.PI * x)
  }

  _cdf (x) {
    return 2 * Math.atan(Math.exp(0.5 * Math.PI * x)) / Math.PI
  }
}
