import { gammaLowerIncompleteInv, logGamma } from '../special'
import Distribution from './_distribution'
import Chi2 from './chi2'

/**
 * Probability density function for the [$\chi$ distribution]{@link https://en.wikipedia.org/wiki/Chi_distribution}:
 *
 * $f(x; k) = \frac{1}{2^{k/2 - 1} \Gamma(k/2)} x^{k - 1} e^{-x^2/2},$
 *
 * where $k \in \mathbb{N}^+$. Support: $x > 0$.
 *
 * Cumulative distribution function:
 *
 * $F(x; k) = P(k/2,\, x^2/2)$
 *
 * where $P(a,x)$ is the regularized lower incomplete gamma function
 *
 * @class Chi
 * @memberof ran.dist
 * @constructor
 */
export default class Chi extends Chi2 {
  // Transformation of chi2 distribution
  /**
   * @param {number} k Degrees of freedom. If not an integer, is rounded to the nearest integer.
   */
  constructor (k) {
    super(k)
    // Validate parameters
    const ki = Math.round(k)
    this.p = Object.assign(this.p, { k: ki })
    Distribution.validate({ k: ki }, [
      'k > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants — use Object.assign to preserve Chi2's this.c.alpha
    Object.assign(this.c, {
      mu: Math.SQRT2 * Math.exp(logGamma((ki + 1) / 2) - logGamma(ki / 2))
    })
  }

  _q (p) {
    // Chi = sqrt(Chi2) = sqrt(Gamma(k/2, 0.5)); invert by sqrt of Gamma quantile
    // solutions/distribution/2026-06-05-0000-gamma-transform-quantile-closed-form.md
    return Math.sqrt(gammaLowerIncompleteInv(this.c.alpha, p) * 2)
  }

  _generator () {
    // Direct sampling by transforming chi2 variate
    return Math.sqrt(super._generator())
  }

  _pdf (x) {
    if (this.p.k === 1 && x === 0) {
      return Math.sqrt(2 / Math.PI)
    } else {
      return 2 * x * super._pdf(x * x)
    }
  }

  _cdf (x) {
    return super._cdf(x * x)
  }

  /**
   * @returns {number} sqrt(2)*Gamma((k+1)/2)/Gamma(k/2).
   */
  mean () {
    return this.c.mu
  }

  /**
   * @returns {number} k minus the squared mean.
   */
  variance () {
    const mu = this.c.mu
    return this.p.k - mu * mu
  }

  /**
   * @returns {number} Mean times (1 - 2*variance) divided by variance^(3/2).
   */
  skewness () {
    const mu = this.c.mu
    const v = this.p.k - mu * mu
    return mu * (1 - 2 * v) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} (2/variance)*(1 - mean*sqrt(variance)*skewness - variance).
   */
  kurtosis () {
    const mu = this.c.mu
    const v = this.p.k - mu * mu
    const g1 = mu * (1 - 2 * v) / Math.pow(v, 1.5)
    return (2 / v) * (1 - mu * Math.sqrt(v) * g1 - v)
  }

  static _fitInit (data) {
    // MLE: k = mean(x²) since X² ~ Chi²(k) implies E[X²] = k
    const n = data.length
    return [data.reduce((s, x) => s + x * x, 0) / n]
  }

  /**
   * @param {number[]} data Array of sample values.
   * @returns {Chi} Fitted distribution.
   */
  static fit (data) {
    const Cls = this
    const [kHat] = Cls._fitInit(data)
    const kSeed = Math.round(kHat)
    const w = Distribution._adaptiveHalfWidth(k => { try { return new Cls(k).lnL(data) } catch (_) { return -Infinity } }, kSeed, 1)
    const kLo = Math.max(1, kSeed - w)
    const kHi = kSeed + w
    let bestK = kSeed
    let bestLnL = -Infinity
    for (let k = kLo; k <= kHi; k++) {
      try {
        const lnL = new Cls(k).lnL(data)
        if (lnL > bestLnL) { bestLnL = lnL; bestK = k }
      } catch (_) {}
    }
    return new Cls(bestK)
  }
}
