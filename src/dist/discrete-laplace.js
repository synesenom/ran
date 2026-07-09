import Distribution from './_distribution'

/**
 * Probability mass function for the [discrete Laplace distribution]{@link https://arxiv.org/pdf/1304.2129}
 * (also called the bilateral geometric distribution):
 *
 * $f(k; p, \mu) = \frac{1-p}{1+p} p^{|k - \mu|},$
 *
 * with $p \in (0, 1)$ and $\mu \in \mathbb{Z}$. Support: $k \in \mathbb{Z}$.
 *
 * @class DiscreteLaplace
 * @memberof ran.dist
 * @constructor
 */
export default class DiscreteLaplace extends Distribution {
  /**
   * @param {number} p Geometric decay parameter.
   * @param {number} mu Integer location parameter. If not an integer, it is rounded to the nearest one.
   */
  constructor (p, mu) {
    super('discrete', 2)

    const mui = Math.round(mu)
    if (!Number.isFinite(mui)) {
      throw new Error(`DiscreteLaplace: mu must be a finite integer, got ${mu}`)
    }
    this.p = { p, mu: mui }
    Distribution.validate({ p, mu: mui }, [
      'p > 0', 'p < 1'
    ])

    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    // Precompute scale and logp — both appear in every _pdf and _generator call.
    this.c = {
      scale: (1 - p) / (1 + p),
      logp: Math.log(p)
    }
  }

  static _fitInit (data) {
    // Method of moments: mean = mu, variance = 2p/(1-p)^2.
    // Solving for p: var*p^2 - (2+2*var)*p + var = 0 → smaller root chosen for 0 < p < 1.
    const n = data.length
    if (n === 0) throw new Error('DiscreteLaplace.fit: data must be non-empty')
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n
    const v = Math.max(variance, 1e-10)
    const p = Math.max(0.001, Math.min(0.999, ((1 + v) - Math.sqrt(1 + 2 * v)) / v))
    return [p, Math.round(mean)]
  }

  _generator () {
    // Difference of two Geometric(1-p) variates via inverse-CDF; Math.max clamps the
    // boundary case where the PRNG emits 0 (log(1)=0 → ceil(0)-1=-1, off-support).
    const g1 = Math.max(0, Math.ceil(Math.log(1 - this.r.next()) / this.c.logp) - 1)
    const g2 = Math.max(0, Math.ceil(Math.log(1 - this.r.next()) / this.c.logp) - 1)
    return g1 - g2 + this.p.mu
  }

  _pdf (x) {
    return this.c.scale * Math.pow(this.p.p, Math.abs(x - this.p.mu))
  }

  _cdf (x) {
    const d = x - this.p.mu
    if (d < 0) {
      return Math.pow(this.p.p, -d) / (1 + this.p.p)
    } else {
      return (1 + this.p.p - Math.pow(this.p.p, d + 1)) / (1 + this.p.p)
    }
  }

  _q (u) {
    if (u <= 1 / (1 + this.p.p)) {
      return Math.ceil(this.p.mu - Math.log(u * (1 + this.p.p)) / this.c.logp)
    } else {
      return Math.ceil(this.p.mu - 1 + Math.log((1 + this.p.p) * (1 - u)) / this.c.logp)
    }
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.p.mu
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const q = 1 - this.p.p
    return 2 * this.p.p / (q * q)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    return 0
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const p = this.p.p
    // Derived from E[(X-mu)^4] = 2*(1-p)/(1+p)*Li_{-4}(p); reduces to (p^2+4p+1)/(2p).
    return (p * p + 4 * p + 1) / (2 * p)
  }
}
