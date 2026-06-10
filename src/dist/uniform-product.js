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
 * Cumulative distribution function:
 *
 * $F(x; n) = Q\!\left(n,\, -\ln x\right)$
 *
 * where $Q(a,x)$ is the regularized upper incomplete gamma function
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
  }

  _generator () {
    return Math.exp(neumaier(Array.from({ length: this.p.n }, () => Math.log(this.r.next()))))
  }

  _pdf (x) {
    return Math.pow(-Math.log(x), this.p.n - 1) / gamma(this.p.n)
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
