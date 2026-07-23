import Distribution from './_distribution'
import NoncentralChi2 from './noncentral-chi2'
import noncentralChi2 from './_noncentral-chi2'
import powell from '../algorithms/powell'

/**
 * Probability density function for the [doubly non-central $\chi^2$ distribution]{@link https://doi.org/10.1093/biomet/36.1-2.202}:
 *
 * $f(x; k_1, k_2, \lambda_1, \lambda_2) = e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum\_{j = 0}^\infty \sum\_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^j}{j!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} f_{\chi^2}\big(x; k_1 + k_2 + 2j + 2l\big),$
 *
 * where $f_{\chi^2}(x; \nu)$ is the central $\chi^2$ density with $\nu$ degrees of freedom, $k_1, k_2 \in \mathbb{N}^+$ and $\lambda_1, \lambda_2 \ge 0$. Support: $x \in [0, \infty)$.
 *
 * @class DoublyNoncentralChi2
 * @memberof ran.dist
 * @constructor
 */
export default class DoublyNoncentralChi2 extends NoncentralChi2 {
  /**
   * @param {number} k1 First degrees of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} k2 Second degrees of freedom. If not an integer, it is rounded to the nearest one.
   * @param {number} lambda1 First non-centrality parameter.
   * @param {number} lambda2 Second non-centrality parameter.
   */
  constructor (k1, k2, lambda1, lambda2) {
    const k1i = Math.round(k1)
    const k2i = Math.round(k2)

    // DNCχ²(k1, k2, λ1, λ2) ≡ ncχ²(k1 + k2, λ1 + λ2): χ² is additive in
    // degrees of freedom and the Poisson noncentrality counts add.
    // See solutions/distribution/2026-05-20-1838-doubly-noncentral-chi2-additivity-collapse.md
    // See solutions/distribution/2026-05-21-1300-doubly-noncentral-chi2-inherit-noncentral-chi2.md
    super(k1i + k2i, lambda1 + lambda2)

    // Only 2 of the 4 constructor arguments are statistically identifiable: the pdf/cdf above
    // (and fit(), below) depend on k1, k2, lambda1, lambda2 only through the sums k1+k2 and
    // lambda1+lambda2, so distinct tuples with the same sums produce the bit-for-bit identical
    // distribution. aic()/bic() must therefore use the identifiable parameter count (2), matching
    // NoncentralChi2's own this.k = 2, not the 4 nominal constructor arguments — explicit here
    // (rather than left implicit via inheritance) to guard against a future regression to 4.
    // See issue #1083.
    this.k = 2

    // decisions/0039-reparametrizing-subclass-nontrivial-parent-delegate.md — NoncentralChi2's
    // _pdf/_cdf/_generator/moments are non-trivial (Bessel-function branches), not one-liners;
    // cache a correctly-parameterized NoncentralChi2 instance and delegate every currently-inherited
    // method to it instead of duplicating its internals or rewriting NoncentralChi2 itself.
    this.ncChi2 = new NoncentralChi2(k1i + k2i, lambda1 + lambda2)

    // Natural params only in this.p — no leaked collapsed k/lambda
    this.p = { k1: k1i, k2: k2i, lambda1, lambda2 }

    // Validate the four individual parameters (super already validated collapsed form)
    Distribution.validate({ k1: k1i, k2: k2i, lambda1, lambda2 }, [
      'k1 > 0',
      'k2 > 0',
      'lambda1 >= 0',
      'lambda2 >= 0'
    ])
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.ncChi2.mean()
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return this.ncChi2.variance()
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    return this.ncChi2.skewness()
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return this.ncChi2.kurtosis()
  }

  /** @inheritdoc */
  static fit (data) {
    // DNCχ²(k1,k2,λ1,λ2) ≡ ncχ²(k1+k2,λ1+λ2); fitting in 4D is degenerate
    // because the likelihood surface is flat in any direction that preserves
    // the sums. Fit in the 2D collapsed space instead, then split symmetrically.
    const collapsed = NoncentralChi2.fit(data)
    let kTot = collapsed.p.k
    let lambdaTot = collapsed.p.lambda
    if (kTot < 2) {
      // kTot=1 can't be split (both k1, k2 must be >= 1). Re-optimize lambda
      // for k=2 because the lambda fitted for k=1 is suboptimal for k=2.
      kTot = 2
      const [optLambda] = powell(
        ([lambda]) => {
          try {
            const v = -new NoncentralChi2(2, Math.max(0, lambda)).lnL(data)
            return isNaN(v) ? Infinity : v
          } catch (_) { return Infinity }
        },
        [lambdaTot]
      )
      lambdaTot = Math.max(0, optLambda)
    }
    const k = Math.max(1, Math.round(kTot / 2))
    return new DoublyNoncentralChi2(k, Math.max(1, kTot - k), lambdaTot / 2, lambdaTot / 2)
  }

  _pdf (x) {
    return this.ncChi2._pdf(x)
  }

  _cdf (x) {
    return this.ncChi2._cdf(x)
  }

  _generator () {
    // Reimplemented against this.r directly rather than delegating to the cached this.ncChi2,
    // which owns its own independent PRNG stream.
    return noncentralChi2(this.r, this.ncChi2.p.k, this.ncChi2.p.lambda)
  }

  _afterLoad () {
    this.ncChi2 = new NoncentralChi2(this.p.k1 + this.p.k2, this.p.lambda1 + this.p.lambda2)
  }
}
