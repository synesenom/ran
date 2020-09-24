import Distribution from './_distribution'
import PreComputed from './_pre-computed'
import logBinomial from '../special/log-binomial'

/**
 * Generator for the [heads-minus-tails distribution]{@link http://mathworld.wolfram.com/Heads-Minus-TailsDistribution.html}:
 *
 * $$f(k; n) = \begin{cases}\Big(\frac{1}{2}\Big)^{2n} \begin{pmatrix}2n \\ n \\ \end{pmatrix} &\quad\text{if $k = 0$},\\2 \Big(\frac{1}{2}\Big)^{2n} \begin{pmatrix}2n \\ m + n \\ \end{pmatrix} &\quad\text{if $k = 2m$},\\0 &\quad\text{else}\\ \end{cases}$$
 *
 * where \(n \in \mathbb{N}^+\). Support: \(k \in [0, n]\).
 *
 * @class HeadsMinusTails
 * @memberof ran.dist
 * @param {number=} n Half number of trials. Default value is 10.
 * @constructor
 */
export default class extends PreComputed {
  constructor (n = 10) {
    super(true)

    // Validate parameters
    const ni = Math.round(n)
    this.p = { n: ni }
    Distribution.validate({ n: ni }, [
      'n >= 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 2 * ni,
      closed: true
    }]

    // Speed-up constants
    this.c = [
      2 * ni * Math.log(0.5)
    ]
  }

  _pk (k) {
    if (k === 0) {
      return this.c[0] + logBinomial(2 * this.p.n, this.p.n)
    } else {
      return k % 2 === 0
        ? Math.log(2) + this.c[0] + logBinomial(2 * this.p.n, Math.round(k / 2) + this.p.n)
        : -Infinity
    }
  }

  _generator () {
    let heads = 0
    for (let i = 0; i < 2 * this.p.n; i++) {
      heads += this.r.next() > 0.5 ? 0 : 1
    }
    return Math.abs(2 * heads - 2 * this.p.n)
  }
}
