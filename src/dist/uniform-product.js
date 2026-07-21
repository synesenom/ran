import Distribution from './_distribution'
import neumaier from '../algorithms/neumaier'
import { gamma, gammaUpperIncomplete } from '../special'

/**
 * Probability density function for the [product of uniform distribution]{@link https://mathworld.wolfram.com/UniformProductDistribution.html}:
 *
 * $f(x; n) = \frac{(-\ln x)^{n-1}}{(n-1)!},$
 *
 * with $n \in \mathbb{N}, n > 1$. Support: $x \in (0, 1\]$.
 *
 * @class UniformProduct
 * @memberof ran.dist
 * @constructor
 */
export default class UniformProduct extends Distribution {
  /**
   * @param {number} n Number of uniform factors. If not an integer, it is rounded to the nearest one.
   */
  constructor (n) {
    super('continuous', 1)

    // Validate parameters
    const ni = Math.round(n)
    this.p = { n: ni }
    Distribution.validate({ n: ni }, [
      'n > 1'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: true
    }]

    // Speed-up constants: m1..m4 are shared verbatim by mean/variance/skewness/kurtosis;
    // gammaN is the x-independent normalizer in _pdf.
    this.c = {
      m1: Math.pow(0.5, ni),
      m2: Math.pow(1 / 3, ni),
      m3: Math.pow(0.25, ni),
      m4: Math.pow(0.2, ni),
      gammaN: gamma(ni)
    }
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.c.m1
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { m1, m2 } = this.c
    return m2 - m1 * m1
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { m1, m2, m3 } = this.c
    const v = m2 - m1 * m1
    const mu3 = m3 - 3 * m2 * m1 + 2 * m1 * m1 * m1
    return mu3 / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { m1, m2, m3, m4 } = this.c
    const v = m2 - m1 * m1
    const m1sq = m1 * m1
    const mu4 = m4 - 4 * m3 * m1 + 6 * m2 * m1sq - 3 * m1sq * m1sq
    return mu4 / (v * v) - 3
  }

  _generator () {
    // 1 - this.r.next() (not this.r.next() directly) since next() is uniform on [0, 1) and can
    // return exactly 0, which would make one term -Infinity and collapse the sum to -Infinity
    // — exp() of that is 0, silently violating this distribution's open lower bound (0, 1].
    return Math.exp(neumaier(Array.from({ length: this.p.n }, () => Math.log(1 - this.r.next()))))
  }

  _pdf (x) {
    return Math.pow(-Math.log(x), this.p.n - 1) / this.c.gammaN
  }

  _cdf (x) {
    return gammaUpperIncomplete(this.p.n, -Math.log(x))
  }

  static _fitInit (data) {
    // n from log-moment: -log(X) = sum of n Exp(1) variates, so E[-log X] = n
    const meanNegLog = data.reduce((s, x) => s - Math.log(x), 0) / data.length
    return [Math.max(2, Math.round(meanNegLog))]
  }

  /**
   * @param {number[]} data Array of sample values.
   * @returns {UniformProduct} Fitted distribution.
   */
  static fit (data) {
    const Cls = this
    const [nHat] = Cls._fitInit(data)
    const nSeed = Math.round(nHat)
    const w = Distribution._adaptiveHalfWidth(n => { try { return new Cls(n).lnL(data) } catch (_) { return -Infinity } }, nSeed, 2)
    const nLo = Math.max(2, nSeed - w)
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
}
