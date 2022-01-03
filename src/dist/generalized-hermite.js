import logGamma from '../special/log-gamma'
import { poisson } from './_core'
import Distribution from './_distribution'
import PreComputed from './_pre-computed'

/**
 * Generator for the [generalized Hermite distribution]{@link https://journal.r-project.org/archive/2015/RJ-2015-035/RJ-2015-035.pdf}:
 *
 * $$f(k; a_1, a_m, m) = p_0 \frac{\mu^k (m - d)^k}{(m - 1)^k} \sum\_{j = 0}^{\lfloor k / m \rfloor} \frac{(d - 1)^j (m - 1)^{(m - 1)j}}{m^j \mu^{(m - 1)j} (m - d)^{mj} (k - mj)! j!},$$
 *
 * where $p_0 = e^{\mu \big\[\frac{d - 1}{m} - 1\big\]}$, $\mu = a_1 + m a_m$, $d = \frac{a_1 + m^2 a_m}{a_1 + m a_m}$,
 * $a_1, a_m > 0$ and $m \in \mathbb{N}^+ \setminus \{ 1 \}$.
 * Support: $k \in \mathbb{N}$. It is the distribution of $X_1 + m X_m$ where $X_1, X_2$ are Poisson variates with
 * parameters $a_1, a_m$ respectively.
 *
 * @class GeneralizedHermite
 * @memberof ran.dist
 * @param {number=} a1 Mean of the first Poisson component. Default value is 1.
 * @param {number=} am Mean of the second Poisson component. Default value is 1.
 * @param {number=} m Multiplier of the second Poisson. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @constructor
 */
export default class extends PreComputed {
  constructor (a1 = 1, a2 = 1, m = 2) {
    // Using raw probability mass values
    super(true)

    // Validate parameters
    const mi = Math.round(m)
    this.p = { a1, a2, m: mi }
    Distribution.validate({ a1, a2, m: mi }, [
      'a1 > 0',
      'a2 > 0',
      'm > 1'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = [
      Math.log(a1 + m * a2),
      (a1 + m * m * a2) / (a1 + m * a2),
      -a1 - a2
    ]
  }

  _pk (k) {
    if (k === 0) {
      return this.c[2]
    }

    if (k < this.p.m) {
      return this.c[2] + k * this.c[0] - logGamma(k + 1) + k * Math.log((this.p.m - this.c[1]) / (this.p.m - 1))
    }

    return this.c[0] +
      Math.log((this.c[1] - 1) * Math.exp(this.pdfTable[k - this.p.m]) + (this.p.m - this.c[1]) * Math.exp(this.pdfTable[k - 1])) -
      Math.log((k * (this.p.m - 1)))
  }

  _generator () {
    return poisson(this.r, this.p.a1) + this.p.m * poisson(this.r, this.p.a2)
  }
}
