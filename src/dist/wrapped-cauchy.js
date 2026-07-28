import Distribution from './_distribution'

/**
 * Probability density function for the [wrapped Cauchy distribution]{@link https://en.wikipedia.org/wiki/Wrapped_Cauchy_distribution}:
 *
 * $f(x; \mu, \rho) = \frac{1 - \rho^2}{2 \pi \big\[1 + \rho^2 - 2 \rho \cos(x - \mu)\big\]},$
 *
 * with $\rho \in (0, 1)$. $\mu$ is not constrained to a specific range -- the density is
 * periodic in $\mu$, so any real value is equivalent to its canonical representative in
 * $\[-\pi, \pi)$. Support: $x \in \[\mu - \pi, \mu + \pi\]$ (a mu-centred window, matching
 * scipy's `vonmises(loc=mu)` convention, since a circular distribution has no canonical fixed
 * cut point independent of its location parameter).
 *
 * @class WrappedCauchy
 * @memberof ran.dist
 * @constructor
 */
export default class WrappedCauchy extends Distribution {
  /**
   * @param {number} mu Mean direction parameter.
   * @param {number} rho Concentration parameter.
   */
  constructor (mu, rho) {
    super('continuous', 2)

    // Validate parameters
    this.p = { mu, rho }
    Distribution.validate({ mu, rho }, [
      'rho > 0',
      'rho < 1'
    ])

    // Set support: centred on mu, not fixed at [-pi, pi] -- the closed-form CDF's atan2 wrap
    // has a branch discontinuity at x = mu + pi (mod 2*pi), so a fixed window would put that
    // discontinuity inside the domain for any mu != 0.
    // See solutions/distribution/2026-07-28-1035-wrapped-cauchy-support-window-vs-fixed-precedent.md
    this.s = [{
      value: mu - Math.PI,
      closed: true
    }, {
      value: mu + Math.PI,
      closed: true
    }]

    // Speed-up constants
    this.c = {
      rho2: rho * rho,
      tanRatio: (1 - rho) / (1 + rho)
    }
  }

  // mean()/variance()/skewness()/kurtosis() are left to the base class's numerical quadrature
  // fallback (always finite here, since support is bounded) -- these return the arithmetic
  // moments over the mu-centred window, not the circular mean resultant length/variance from
  // directional statistics, matching VonMises's precedent for the codebase's only other
  // circular distribution.

  _generator () {
    // Inverse transform sampling: same closed-form quantile as _q, applied to a uniform draw
    return this.p.mu + 2 * Math.atan(this.c.tanRatio * Math.tan(Math.PI * (this.r.next() - 0.5)))
  }

  _pdf (x) {
    const rho = this.p.rho
    return (1 - this.c.rho2) / (2 * Math.PI * (1 + this.c.rho2 - 2 * rho * Math.cos(x - this.p.mu)))
  }

  _cdf (x) {
    // atan2 avoids the tan(d/2) singularity at d = ±pi (the support boundary)
    const d = Math.atan2(Math.sin(x - this.p.mu), Math.cos(x - this.p.mu))
    const rho = this.p.rho
    return 0.5 + Math.atan2((1 + rho) * Math.sin(d / 2), (1 - rho) * Math.cos(d / 2)) / Math.PI
  }

  _q (p) {
    return this.p.mu + 2 * Math.atan(this.c.tanRatio * Math.tan(Math.PI * (p - 0.5)))
  }

  static _fitInit (data) {
    // Trigonometric moment estimator: no closed-form MLE exists in general (Kent & Tyler, 1988,
    // J. Applied Statistics 15(2):247-254), so mu/rho come from the circular resultant vector.
    const n = data.length
    let sumCos = 0
    let sumSin = 0
    let sumX = 0
    for (let i = 0; i < n; i++) {
      sumCos += Math.cos(data[i])
      sumSin += Math.sin(data[i])
      sumX += data[i]
    }
    const C = sumCos / n
    const S = sumSin / n
    // atan2(S, C) only ever returns the canonical representative in (-pi, pi], but mu itself is
    // unconstrained -- shift by the nearest multiple of 2*pi to the data's own mean so the fitted
    // support window [mu-pi, mu+pi] actually contains data sampled from an off-canonical mu
    const dataMean = sumX / n
    const canonicalMu = Math.atan2(S, C)
    const mu = canonicalMu + 2 * Math.PI * Math.round((dataMean - canonicalMu) / (2 * Math.PI))
    const rho = Math.min(1 - 1e-3, Math.max(1e-3, Math.sqrt(C * C + S * S)))
    return [mu, rho]
  }
}
