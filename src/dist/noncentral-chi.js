import Distribution from './_distribution'
import NoncentralChi2 from './noncentral-chi2'

/**
 * Generator for the [non-central $\chi$ distribution]{@link https://en.wikipedia.org/wiki/Noncentral_chi_distribution}:
 *
 * $$f(x; k; \lambda) = \frac{x^k \lambda}{(\lambda x)^{k/2}} e^{-\frac{x^2 + \lambda^2}{2}} I_{k/2 - 1}(\lambda x),$$
 *
 * with $k \in \mathbb{N}^+$, $\lambda > 0$ and $I_n(x)$ is the modified Bessel function of the first kind with order $n$. Support: $x \in [0, \infty)$.
 *
 * @class NoncentralChi
 * @memberof ran.dist
 * @param {number=} k Degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @constructor
 */
export default class extends NoncentralChi2 {
  // Transformation of non-central chi2 distribution
  constructor (k = 2, lambda = 1) {
    const ki = Math.round(k)
    super(ki, lambda * lambda)

    // Validate parameters
    Distribution.validate({ k: ki, lambda }, [
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

  _generator () {
    // Direct sampling by transforming non-central chi2 variate
    return Math.sqrt(super._generator())
  }

  _pdf (x) {
    return 2 * x * super._pdf(x * x)
  }

  _cdf (x) {
    return super._cdf(x * x)
  }
}
