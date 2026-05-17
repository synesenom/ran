import F from './f'

/**
 * Generator for [Fisher's z distribution]{@link https://en.wikipedia.org/wiki/Fisher%27s_z-distribution}:
 *
 * $$f(x; d_1, d_2) = \sqrt{\frac{d_1^{d_1} d_2^{d_2}}{(d_1 e^{2 x} + d_2)^{d_1 + d_2}}} \frac{2 e^{d_1 x}}{\mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$$
 *
 * with $d_1, d_2 > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class FisherZ
 * @memberof ran.dist
 * @param {number=} d1 First degree of freedom. Default value is 2.
 * @param {number=} d2 Second degree of freedom. Default value is 2.
 * @constructor
 */
export default class extends F {
  // Transformation of F
  constructor (d1, d2) {
    const d1i = Math.round(d1)
    const d2i = Math.round(d2)
    super(d1i / 2, d2i / 2)

    // this.c[0] is logBeta(d1/2, d2/2) from Beta's constructor; indices 1-2 also used by Beta
    this.c[3] = Math.LN2 + (this.p.d1 / 2) * Math.log(this.p.d1) + (this.p.d2 / 2) * Math.log(this.p.d2) - this.c[0]

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
    // Direct sampling by transforming F variate
    return 0.5 * Math.log(super._generator())
  }

  // See solutions/distribution/2026-05-15-1921-fisher-z-pdf-log-space-overflow.md
  _pdf (x) {
    const t = 2 * x
    const logSum = t >= 0
      ? t + Math.log(this.p.d1 + this.p.d2 * Math.exp(-t))
      : Math.log(this.p.d2 + this.p.d1 * Math.exp(t))
    return Math.exp(this.c[3] + this.p.d1 * x - ((this.p.d1 + this.p.d2) / 2) * logSum)
  }

  _cdf (x) {
    return super._cdf(Math.exp(2 * x))
  }
}
