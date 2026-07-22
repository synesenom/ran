import Distribution from './_distribution'
import NoncentralBeta from './noncentral-beta'
import noncentralChi2 from './_noncentral-chi2'
import chi2 from './_chi2'

/**
 * Probability density function for the [non-central F distribution]{@link https://en.wikipedia.org/wiki/Noncentral_F-distribution}:
 *
 * $f(x; d\_1, d\_2, \lambda) = e^{-\frac{\lambda}{2}} \sum\_{k=0}^\infty \frac{1}{k!} \bigg(\frac{\lambda}{2}\bigg)^k \frac{\Big(\frac{d_1}{d_2}\Big)^{\frac{d_1}{2} + k} \Big(\frac{d_2}{d_2 + d_1 x}\Big)^{\frac{d_1 + d_2}{2} + k}}{\mathrm{B}\Big(\frac{d_2}{2}, \frac{d_1}{2} + k\Big)} x^{\frac{d_1}{2} -1 + k},$
 *
 * where $d_1, d_2 \in \mathbb{N}^+$ and $\lambda > 0$. Support: $x \ge 0$.
 *
 * @class NoncentralF
 * @memberof ran.dist
 * @constructor
 */
export default class NoncentralF extends NoncentralBeta {
  // Transformation of non-central beta distribution
  /**
   * @param {number} d1 First degree of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} d2 Second degree of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} lambda Non-centrality parameter.
   */
  constructor (d1, d2, lambda) {
    const d1i = Math.round(d1)
    const d2i = Math.round(d2)
    super(d1i / 2, d2i / 2, lambda)

    // decisions/0039-reparametrizing-subclass-nontrivial-parent-delegate.md — NoncentralBeta's
    // _pdf/_cdf are non-trivial series algorithms reading this.p.alpha/this.p.beta throughout, not
    // a one-liner; cache a correctly-parameterized NoncentralBeta instance and delegate to it
    // instead of duplicating its internals or rewriting NoncentralBeta itself.
    this.ncBeta = new NoncentralBeta(d1i / 2, d2i / 2, lambda)

    // Validate parameters
    this.p = { d1: d1i, d2: d2i, lambda }
    Distribution.validate({ d1: d1i, d2: d2i, lambda }, [
      'd1 > 0',
      'd2 > 0',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  // Raw moment E[X^j] = (d2/d1)^j · m_j / Π_{i=1..j}(d2 - 2i) for d2 > 2j, where m_j is the j-th
  // raw moment of the numerator's noncentral chi2(d1, λ) assembled from its cumulants
  // κ_n = 2^(n-1)·(n-1)!·(d1 + nλ); the Γ-ratio of E[(χ²_{d2})^(-j)] folds into the finite product.
  _rawMoment (j) {
    const { d1, d2, lambda } = this.p
    const k1 = d1 + lambda
    const k2 = 2 * (d1 + 2 * lambda)
    const k3 = 8 * (d1 + 3 * lambda)
    const k4 = 48 * (d1 + 4 * lambda)
    const m = [1, k1, k2 + k1 * k1, k3 + 3 * k2 * k1 + k1 * k1 * k1, k4 + 4 * k3 * k1 + 3 * k2 * k2 + 6 * k2 * k1 * k1 + k1 * k1 * k1 * k1][j]
    let denom = 1
    for (let i = 1; i <= j; i++) {
      denom *= d2 - 2 * i
    }
    return Math.pow(d2 / d1, j) * m / denom
  }

  // Moment overrides shadow NoncentralBeta's, which describe NcBeta(d1/2, d2/2, λ), not the
  // transformed F variate. Positive support: every divergent moment is +Infinity, never NaN.
  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const { d1, d2, lambda } = this.p
    return d2 > 2 ? d2 * (d1 + lambda) / (d1 * (d2 - 2)) : Infinity
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { d1, d2, lambda } = this.p
    if (d2 > 4) {
      const r = d2 / d1
      return 2 * r * r * ((d1 + lambda) * (d1 + lambda) + (d1 + 2 * lambda) * (d2 - 2)) / ((d2 - 2) * (d2 - 2) * (d2 - 4))
    }
    return Infinity
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    if (this.p.d2 <= 6) return Infinity
    const r1 = this._rawMoment(1)
    const r2 = this._rawMoment(2)
    const r3 = this._rawMoment(3)
    const v = r2 - r1 * r1
    return (r3 - 3 * r1 * r2 + 2 * r1 * r1 * r1) / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    if (this.p.d2 <= 8) return Infinity
    const r1 = this._rawMoment(1)
    const r2 = this._rawMoment(2)
    const r3 = this._rawMoment(3)
    const r4 = this._rawMoment(4)
    const v = r2 - r1 * r1
    return (r4 - 4 * r1 * r3 + 6 * r1 * r1 * r2 - 3 * r1 * r1 * r1 * r1) / (v * v) - 3
  }

  _generator () {
    // Direct sampling by transforming non-central beta variate. Reimplemented against this.r
    // directly (mirroring NoncentralBeta.prototype._generator) rather than delegating to the
    // cached this.ncBeta, which owns its own independent PRNG stream.
    const x = noncentralChi2(this.r, this.p.d1, this.p.lambda)
    const y = chi2(this.r, this.p.d2)
    const z = x / (x + y)
    const beta = Math.abs(1 - z) < Number.EPSILON ? 1 - y / x : z
    return this.p.d2 * beta / (this.p.d1 * (1 - beta))
  }

  _pdf (x) {
    if (x === 0) return 0
    return this.p.d1 * this.p.d2 * this.ncBeta._pdf(this.p.d1 * x / (this.p.d2 + this.p.d1 * x)) / Math.pow(this.p.d2 + this.p.d1 * x, 2)
  }

  _cdf (x) {
    if (x === 0) return 0
    const y = this.p.d1 * x
    return this.ncBeta._cdf(1 / (1 + this.p.d2 / y))
  }

  _afterLoad () {
    this.ncBeta = new NoncentralBeta(this.p.d1 / 2, this.p.d2 / 2, this.p.lambda)
  }

  static _fitInit (data) {
    // Central F moments: E[X]=d2/(d2-2)→d2, Var[X]→d1; λ from E[NoncentralF]=d2(d1+λ)/(d1(d2-2))
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || 1
    const d2 = mean > 1 ? Math.max(3, Math.round(2 * mean / (mean - 1))) : 5
    const d1formula = d2 > 4
      ? Math.round(2 * d2 * d2 * (d2 - 2) / (variance * (d2 - 2) ** 2 * (d2 - 4) - 2 * d2 * d2))
      : 0
    const d1 = d1formula > 0 && isFinite(d1formula) ? Math.max(1, d1formula) : d2
    return [d1, d2, Math.max(1e-3, mean * d1 * (d2 - 2) / d2 - d1)]
  }
}
