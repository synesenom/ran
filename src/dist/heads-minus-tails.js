import Distribution from './_distribution'
import PreComputed from './_pre-computed'
import { logBinomial } from '../special'

/**
 * Probability mass function for the absolute-value (folded) [heads-minus-tails distribution]{@link http://mathworld.wolfram.com/Heads-Minus-TailsDistribution.html}:
 *
 * $f(k; n) = \begin{cases}\Big(\frac{1}{2}\Big)^{2n} \begin{pmatrix}2n \\\\ n \\\\ \end{pmatrix} &\quad\text{if $k = 0$},\\\\2 \Big(\frac{1}{2}\Big)^{2n} \begin{pmatrix}2n \\\\ m + n \\\\ \end{pmatrix} &\quad\text{if $k = 2m$},\\\\0 &\quad\text{else}\\\\ \end{cases}$
 *
 * where $n \in \mathbb{N}^+$. Support: $k \in \[0, 2n\]$.
 *
 * @class HeadsMinusTails
 * @memberof ran.dist
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
    const baseLogProb = 2 * ni * Math.log(0.5)
    Object.assign(this.c, {
      baseLogProb,
      // A = C(2n,n)/4^n; shared verbatim by mean/variance/skewness/kurtosis.
      A: Math.exp(logBinomial(2 * ni, ni) + baseLogProb)
    })
  }

  static _fitInit (data) {
    // Support upper bound is 2n, so max(data) ≈ 2n for large samples.
    const maxVal = data.reduce((m, x) => x > m ? x : m, 0)
    return [Math.max(1, Math.round(maxVal / 2))]
  }

  /**
   * @param {number[]} data Array of sample values.
   * @returns {HeadsMinusTails} Fitted distribution.
   */
  static fit (data) {
    const Cls = this
    const [nHat] = Cls._fitInit(data)
    const nSeed = Math.round(nHat)
    const w = Distribution._adaptiveHalfWidth(n => { try { return new Cls(n).lnL(data) } catch (_) { return -Infinity } }, nSeed, 1)
    const nLo = Math.max(1, nSeed - w)
    const nHi = nSeed + w
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

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const n = this.p.n
    // A = C(2n,n)/4^n; E[X] = 2n*A derived from E[|H-n|] where H~Binomial(2n,1/2).
    return 2 * n * this.c.A
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const n = this.p.n
    // E[X²] = 4*Var(H) = 4*(2n/4) = 2n; Var[X] = E[X²] - E[X]².
    const A = this.c.A
    return 2 * n - 4 * n * n * A * A
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const n = this.p.n
    // E[|H-n|³] = n²*C(2n,n)/4^n (verified analytically for n=1,2,3).
    const A = this.c.A
    const variance = 2 * n - 4 * n * n * A * A
    if (!(variance > 0)) return NaN
    const mu3 = 4 * n * n * A * (4 * n * A * A - 1)
    return mu3 / Math.pow(variance, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const n = this.p.n
    // E[X⁴] = 16*μ₄(H) = 16*(κ₄(H)+3κ₂(H)²) where κ₂=-n/4, κ₄=κ₂ for Binomial(2n,1/2).
    const A2 = this.c.A * this.c.A
    const variance = 2 * n - 4 * n * n * A2
    if (!(variance > 0)) return NaN
    const mu4 = 4 * n * (3 * n - 1) - 16 * n * n * n * A2 - 48 * n * n * n * n * A2 * A2
    return mu4 / (variance * variance) - 3
  }
}
