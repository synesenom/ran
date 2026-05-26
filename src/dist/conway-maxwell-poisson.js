import Distribution from './_distribution'
import PreComputed from './_pre-computed'

/**
 * Generator for the [Conway-Maxwell-Poisson distribution]{@link https://en.wikipedia.org/wiki/Conway%E2%80%93Maxwell%E2%80%93Poisson_distribution}:
 *
 * $f(k; \lambda, \nu) = \frac{\lambda^k}{(k!)^\nu Z(\lambda, \nu)},$
 *
 * where $\lambda > 0$, $\nu > 0$, and $Z(\lambda, \nu) = \sum_{j=0}^\infty \frac{\lambda^j}{(j!)^\nu}$.
 * Support: $k \in \mathbb{N}_0$.
 *
 * @class ConwayMaxwellPoisson
 * @memberof ran.dist
 * @constructor
 */
export default class ConwayMaxwellPoisson extends PreComputed {
  /**
   * @param {number} lambda Rate parameter (lambda > 0).
   * @param {number} nu Dispersion parameter (nu > 0). nu = 1 gives Poisson, nu > 1 gives underdispersion.
   */
  constructor (lambda, nu) {
    super()
    this.k = 2

    this.p = { lambda, nu }
    Distribution.validate({ lambda, nu }, [
      'lambda > 0',
      'nu > 0'
    ])

    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Compute Z = sum_{j=0}^inf lambda^j / (j!)^nu iteratively until the next term is
    // negligible relative to the accumulated sum. The series always converges for lambda>0,
    // nu>0 because term ratio lambda/(j+1)^nu -> 0 as j -> inf.
    let Z = 0
    let term = 1
    let j = 0
    do {
      Z += term
      j++
      term *= lambda / Math.pow(j, nu)
    } while (term > 1e-14 * Z)
    Z += term

    this.c = {
      p0: 1 / Z
    }
  }

  _pk (k) {
    if (k === 0) {
      return this.c.p0
    }
    return this.pdfTable[k - 1] * this.p.lambda / Math.pow(k, this.p.nu)
  }

  // The running-sum CDF can accumulate to 1 + 1 ULP due to floating-point rounding.
  // Clamping here prevents the monotonicity invariant from being violated for large k.
  // See solutions/correctness/2026-05-26-1210-precomputed-cdf-asymmetric-clamping.md
  _cdf (x) {
    if (x < this.cdfTable.length) {
      return Math.min(1, this.cdfTable[x])
    }
    this._advance(x)
    return Math.min(1, this.cdfTable[x])
  }
}
