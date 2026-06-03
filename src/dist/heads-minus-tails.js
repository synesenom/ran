import Distribution from './_distribution'
import PreComputed from './_pre-computed'
import { logBinomial } from '../special'

/**
 * Probability mass function for the absolute-value (folded) heads-minus-tails distribution, i.e. the distribution of
 * $|H - T|$ where $H$ is the number of heads in $2n$ fair coin flips and $T = 2n - H$ is the number
 * of tails. This is the non-negative folded variant; the signed $H - T$ distribution (support
 * $[-2n, 2n]$) is described at the MathWorld reference below:
 *
 * $f(k; n) = \begin{cases}\Big(\frac{1}{2}\Big)^{2n} \begin{pmatrix}2n \\\\ n \\\\ \end{pmatrix} &\quad\text{if $k = 0$},\\\\2 \Big(\frac{1}{2}\Big)^{2n} \begin{pmatrix}2n \\\\ m + n \\\\ \end{pmatrix} &\quad\text{if $k = 2m$},\\\\0 &\quad\text{else}\\\\ \end{cases}$
 *
 * where $n \in \mathbb{N}^+$. Support: $k \in \[0, 2n\]$.
 *
 * @class HeadsMinusTails
 * @memberof ran.dist
 * @see http://mathworld.wolfram.com/Heads-Minus-TailsDistribution.html
 * @constructor
 */
export default class HeadsMinusTails extends PreComputed {
  /**
   * @param {number} n Half number of trials (n > 0).
   */
  constructor (n) {
    super(true)
    this.k = 1

    // Validate parameters
    const ni = Math.round(n)
    this.p = { n: ni }
    Distribution.validate({ n: ni }, [
      'n > 0'
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
    this.c = {
      baseLogProb: 2 * ni * Math.log(0.5)
    }
  }

  static _fitInit (data) {
    // Support upper bound is 2n, so max(data) ≈ 2n for large samples.
    const maxVal = data.reduce((m, x) => x > m ? x : m, 0)
    return [Math.max(1, Math.round(maxVal / 2))]
  }

  static fit (data) {
    const Cls = this
    const [nHat] = Cls._fitInit(data)
    const nSeed = Math.round(nHat)
    const nLo = Math.max(1, nSeed - 5)
    const nHi = nSeed + 5
    let bestN = nSeed
    let bestLnL = -Infinity
    for (let n = nLo; n <= nHi; n++) {
      try {
        const lnL = new Cls(n).lnL(data)
        if (lnL > bestLnL) { bestLnL = lnL; bestN = n }
      } catch (_) {}
    }
    return new Cls(bestN)
  }

  _pk (k) {
    if (k === 0) {
      return this.c.baseLogProb + logBinomial(2 * this.p.n, this.p.n)
    } else {
      return k % 2 === 0
        ? Math.log(2) + this.c.baseLogProb + logBinomial(2 * this.p.n, Math.round(k / 2) + this.p.n)
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
