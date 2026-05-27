import Distribution from './_distribution'

/**
 * Probability function for the [Cauchy distribution]{@link https://en.wikipedia.org/wiki/Cauchy_distribution}:
 *
 * $f(x; x_0, \gamma) = \frac{1}{\pi\gamma\bigg\[1 + \Big(\frac{x - x_0}{\gamma}\Big)^2\bigg\]}$
 *
 * where $x_0 \in \mathbb{R}$ and $\gamma > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Cauchy
 * @memberof ran.dist
 * @constructor
 */
export default class Cauchy extends Distribution {
  /**
   * @param {number} x0 Location parameter.
   * @param {number} gamma Scale parameter.
   */
  constructor (x0, gamma) {
    super('continuous', 2)

    // Validate parameters
    this.p = { x0, gamma }
    Distribution.validate({ x0, gamma }, [
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
    this.c = {
      piGamma: Math.PI * this.p.gamma
    }
  }

  _generator () {
    // Inverse transform sampling
    return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (this.r.next() - 0.5)))
  }

  _pdf (x) {
    const y = (x - this.p.x0) / this.p.gamma
    return 1 / (this.c.piGamma * (1 + y * y))
  }

  _cdf (x) {
    return 0.5 + Math.atan2(x - this.p.x0, this.p.gamma) / Math.PI
  }

  _q (p) {
    return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (p - 0.5)))
  }
}
