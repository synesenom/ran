import { besselI, besselISpherical, marcumP, logGamma } from '../special'
import noncentralChi2 from './_noncentral-chi2'
import Distribution from './_distribution'

/**
 * Generator for the [doubly non-central $\chi^2$ distribution]{@link https://rdrr.io/cran/sadists/f/inst/doc/sadists.pdf}:
 *
 * $$f(x; k_1, k_2, \lambda_1, \lambda_2) = e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum\_{j = 0}^\infty \sum\_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^j}{j!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} f_{\chi^2}\big(x; k_1 + k_2 + 2j + 2l\big),$$
 *
 * where $f_{\chi^2}(x; \nu)$ is the central $\chi^2$ density with $\nu$ degrees of freedom, $k_1, k_2 \in \mathbb{N}^+$ and $\lambda_1, \lambda_2 \ge 0$. Support: $x \in [0, \infty)$.
 *
 * @class DoublyNoncentralChi2
 * @memberof ran.dist
 * @param {number=} k1 First degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 1.
 * @param {number=} k2 Second degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 1.
 * @param {number=} lambda1 First non-centrality parameter. Default value is 1.
 * @param {number=} lambda2 Second non-centrality parameter. Default value is 1.
 * @see https://rdrr.io/cran/sadists/f/inst/doc/sadists.pdf
 * @constructor
 */
export default class extends Distribution {
  constructor (k1, k2, lambda1, lambda2) {
    super('continuous', 4)

    // Validate parameters
    const k1i = Math.round(k1)
    const k2i = Math.round(k2)
    this.p = { k1: k1i, k2: k2i, lambda1, lambda2 }
    Distribution.validate({ k1: k1i, k2: k2i, lambda1, lambda2 }, [
      'k1 > 0',
      'k2 > 0',
      'lambda1 >= 0',
      'lambda2 >= 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // The sum of two independent non-central chi-squares is itself a
    // non-central chi-square: DNCχ²(k1, k2, λ1, λ2) ≡ ncχ²(k1 + k2, λ1 + λ2),
    // since χ² is additive in degrees of freedom and the Poisson noncentrality
    // counts add. The double series collapses to a single one by the binomial
    // theorem.
    // See solutions/distribution/2026-05-20-1838-doubly-noncentral-chi2-additivity-collapse.md
    // Speed-up constants: [collapsed dof, collapsed noncentrality, dof is even]
    this.c = [k1i + k2i, lambda1 + lambda2, (k1i + k2i) % 2 === 0]
  }

  _generator () {
    // Direct sampling from the equivalent non-central chi-square
    return noncentralChi2(this.r, this.c[0], this.c[1])
  }

  _pdf (x) {
    const k = this.c[0]
    const lambda = this.c[1]

    if (lambda === 0) {
      // λ1 = λ2 = 0 reduces to a central chi-square; the non-central Bessel
      // form below divides by λ and cannot be evaluated here
      if (k === 2 && x === 0) {
        return 0.5
      }
      return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - logGamma(k / 2))
    }

    if (this.c[2]) {
      // k is even
      if (k === 2 && x === 0) {
        // k = 2, x -> 0, by differentiating F(x)
        return 0.5 * Math.exp(-0.5 * lambda)
      }
      return 0.5 * Math.exp(-0.5 * (x + lambda) + (k / 4 - 0.5) * Math.log(x / lambda)) * besselI(Math.round(k / 2) - 1, Math.sqrt(lambda * x))
    }

    // k is odd; k = k1 + k2 >= 2, so the k = 1 limit of NoncentralChi2 never applies
    return 0.5 * Math.exp(-0.5 * (x + lambda)) * Math.pow(x / lambda, k / 4 - 0.5) * besselISpherical(Math.floor((k - 3) / 2), Math.sqrt(lambda * x)) * Math.sqrt(2 * Math.sqrt(x * lambda) / Math.PI)
  }

  _cdf (x) {
    // marcumP handles λ = 0 (it reduces to the central chi-square CDF), so no
    // separate branch is needed here
    return marcumP(this.c[0] / 2, this.c[1] / 2, x / 2)
  }
}
