import recursiveSum from '../algorithms/recursive-sum'
import { besselI } from '../special'
import Distribution from './_distribution'
import { MAX_ITER } from '../special/_core'

/**
 * Generator for the [von Mises distribution]{@link https://en.wikipedia.org/wiki/Von_Mises_distribution}:
 *
 * $$f(x; \kappa) = \frac{e^{\kappa \cos(x)}}{2 \pi I_0(\kappa)},$$
 *
 * with $\kappa > 0$. Support: $x \in \[-\pi, \pi\]$. Note that originally this distribution is periodic and therefore it is defined over $\mathbb{R}$, but (without the loss of general usage) this implementation still does limit the support on the bounded interval $\[-\pi, \pi\]$.
 *
 * @class VonMises
 * @memberof ran.dist
 * @param {number=} kappa Shape parameter. Default value is 1.
 * @constructor
 */
export default class extends Distribution {
  constructor (kappa = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { kappa }
    Distribution.validate({ kappa }, [
      'kappa > 0'
    ])

    // Set support
    this.s = [{
      value: -Math.PI,
      closed: true
    }, {
      value: Math.PI,
      closed: true
    }]
  }

  _generator () {
    // Sampling method from here: http://sa-ijas.stat.unipd.it/sites/sa-ijas.stat.unipd.it/files/417-426.pdf
    // Source: Barabesi. Generating von Mises variates by the ratio-of-uniforms method. Statistica Applicata 7 (4), 1995.
    const s = this.p.kappa > 1.3 ? 1 / Math.sqrt(this.p.kappa) : Math.PI * Math.exp(-this.p.kappa)

    for (let i = 0; i < MAX_ITER; i++) {
      const R1 = this.r.next()
      const R2 = this.r.next()
      const theta = s * (2 * R2 - 1) / R1
      if (Math.abs(theta) > Math.PI) {
        continue
      }

      if (this.p.kappa * theta * theta < 4 - 4 * R1) {
        return theta
      } else {
        if (this.p.kappa * Math.cos(theta) < 2 * Math.log(R1) + this.p.kappa) {
          continue
        }
        return theta
      }
    }
  }

  _pdf (x) {
    return Math.exp(this.p.kappa * Math.cos(x)) / (2 * Math.PI * besselI(0, this.p.kappa))
  }

  _cdf (x) {
    // F(x) is computed according to the sum in https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_vonmises.html
    return 0.5 * (1 + x / Math.PI) + recursiveSum({
      c: 0
    }, (t, i) => {
      t.c = besselI(i, this.p.kappa) * Math.sin(i * x) / (besselI(0, this.p.kappa) * i)
      return t
    }, t => t.c) / Math.PI
  }
}
