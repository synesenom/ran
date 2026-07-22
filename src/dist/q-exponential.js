import GeneralizedPareto from './generalized-pareto'
import Distribution from './_distribution'

/**
 * Probability density function for the [q-exponential distribution]{@link https://en.wikipedia.org/wiki/Q-exponential_distribution}:
 *
 * $f(x; q, \lambda) = (2 - q) \lambda e^{-\lambda x}_q,$
 *
 * where $q < 2$, $\lambda > 0$ and $e^x_q$ denotes the [q-exponential function]{@link https://en.wikipedia.org/wiki/Tsallis_statistics#q-exponential}. Support: $x > 0$ if $q \ge 1$, otherwise $x \in \big[0, \frac{1}{\lambda (1 - q)}\big)$.
 *
 * @class QExponential
 * @memberof ran.dist
 * @constructor
 */
export default class QExponential extends GeneralizedPareto {
  /**
   * @param {number} q Shape parameter.
   * @param {number} lambda Rate parameter.
   */
  constructor (q, lambda) {
    super(0, 1 / (lambda * (2 - q)), (q - 1) / (2 - q))

    // QExponential has 2 free parameters (q, lambda); override the 3 inherited from GeneralizedPareto
    // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
    this.k = 2

    // Validate parameters
    Distribution.validate({ q, lambda }, [
      'q < 2',
      'lambda > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: q < 1 ? 1 / (lambda * (1 - q)) : Infinity,
      closed: false
    }]

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p;
    // GP canonical params relocated to this.c for methods that still need them.
    // solutions/distribution/2026-07-22-0635-qexponential-exception-reversal-and-derived-boundary-gap.md
    const { mu, sigma, xi } = this.p
    this.p = { q, lambda }
    Object.assign(this.c, { mu, sigma, xi })
  }

  /**
   * @returns {number} sigma/(1-xi), or Infinity when xi >= 1.
   */
  mean () {
    // See solutions/distribution/2026-06-09-1400-qexponential-parent-params-and-ieee754-boundaries.md
    // xi/sigma live in this.c — this.p holds only the natural params (q, lambda)
    const xi = this.c.xi
    if (xi >= 1) return Infinity
    return this.c.sigma / (1 - xi)
  }

  /**
   * @returns {number} sigma^2/((1-xi)^2*(1-2*xi)), or Infinity when xi >= 1/2.
   */
  variance () {
    const xi = this.c.xi
    if (xi >= 0.5) return Infinity
    const om = 1 - xi
    return this.c.sigma * this.c.sigma / (om * om * (1 - 2 * xi))
  }

  /**
   * @returns {number} 2*(1+xi)*sqrt(1-2*xi)/(1-3*xi); Infinity when 1/3 <= xi < 1/2 (finite variance,
   * divergent third moment); NaN when xi >= 1/2 (variance itself infinite — indeterminate ratio).
   */
  skewness () {
    const xi = this.c.xi
    if (xi >= 1 / 3) return xi < 0.5 ? Infinity : NaN
    return 2 * (1 + xi) * Math.sqrt(1 - 2 * xi) / (1 - 3 * xi)
  }

  /**
   * @returns {number} Excess kurtosis of the GP distribution; Infinity when 1/4 <= xi < 1/2 (finite
   * variance, divergent fourth moment); NaN when xi >= 1/2 (variance itself infinite — indeterminate ratio).
   */
  kurtosis () {
    const xi = this.c.xi
    if (xi >= 0.25) return xi < 0.5 ? Infinity : NaN
    return 3 * (1 - 2 * xi) * (2 * xi * xi + xi + 3) / ((1 - 3 * xi) * (1 - 4 * xi)) - 3
  }

  _pdf (x) {
    // GeneralizedPareto.prototype._pdf specialized to this.c (GP canonical params)
    const z = (x - this.c.mu) / this.c.sigma
    return this.c.xi === 0
      ? Math.exp(-z) / this.c.sigma
      : Math.pow(1 + this.c.xi * z, -1 / this.c.xi - 1) / this.c.sigma
  }

  _cdf (x) {
    // GeneralizedPareto.prototype._cdf specialized to this.c (GP canonical params)
    const z = (x - this.c.mu) / this.c.sigma
    return this.c.xi === 0
      ? -Math.expm1(-z)
      : -Math.expm1(-Math.log1p(this.c.xi * z) / this.c.xi)
  }

  _q (p) {
    // GeneralizedPareto.prototype._q specialized to this.c (GP canonical params)
    const y = this.c.xi === 0 ? -Math.log(1 - p) : (Math.pow(1 - p, -this.c.xi) - 1) / this.c.xi
    return this.c.mu + this.c.sigma * y
  }

  static _fitInit (data) {
    // MOM: r=Var/E²=(2−q)/(4−3q) inverts to q=(2−4r)/(1−3r) for r>1/3 (where variance exists)
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n || mean * mean
    const r = variance / (mean * mean)
    const q = r > 1 / 3 ? Math.max((2 - 4 * r) / (1 - 3 * r), -5) : 0
    const lambda = Math.max(1 / (mean * (3 - 2 * q)), 1e-3)
    return [q, lambda]
  }
}
