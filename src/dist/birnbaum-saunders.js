import Normal from './normal'
import Distribution from './_distribution'
import { erfc, erfinv } from '../special'
import normal from './_normal'

/**
 * Probability density function for the [Birnbaum-Saunders distribution]{@link https://en.wikipedia.org/wiki/Birnbaum%E2%80%93Saunders_distribution} (also known as fatigue life distribution):
 *
 * $f(x; \mu, \beta, \gamma) = \frac{z + 1 / z}{2 \gamma (x - \mu)} \phi\Big(\frac{z - 1 / z}{\gamma}\Big),$
 *
 * with $\mu \in \mathbb{R}$, $\beta, \gamma > 0$, $z = \sqrt{\frac{x - \mu}{\beta}}$ and $\phi(x)$ is the probability density function of the standard [normal distribution]{@link #dist.Normal}. Support: $x \in (\mu, \infty)$.
 *
 * @class BirnbaumSaunders
 * @memberof ran.dist
 * @constructor
 */
export default class BirnbaumSaunders extends Normal {
  // Transformation of normal distribution
  /**
   * @param {number} mu Location parameter.
   * @param {number} beta Scale parameter.
   * @param {number} gamma Shape parameter.
   */
  constructor (mu, beta, gamma) {
    super(0, 1)

    // BirnbaumSaunders has 3 free parameters (mu, beta, gamma); override the 2 inherited from Normal
    // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
    this.k = 3

    // Validate parameters
    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p;
    // mu/sigma leaked from Normal(0,1) are dropped, and the constructor's own mu now occupies its
    // natural key instead of the renamed mu2
    this.p = { mu, beta, gamma }
    Distribution.validate({ mu, beta, gamma }, [
      'beta > 0',
      'gamma > 0'
    ])

    // Set support
    this.s = [{
      value: mu,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  static _fitInit (data) {
    // Fatigue-life modified-moment estimators on data shifted by mu≈min−ε: β=√(s·r), γ²=s/β+β/r−2 (s,r = arithmetic/harmonic means)
    const n = data.length
    const min = Math.min(...data)
    const mu = min - 1e-3 * (Math.abs(min) + 1)
    const y = data.map(x => x - mu)
    const s = y.reduce((acc, v) => acc + v, 0) / n
    const r = n / y.reduce((acc, v) => acc + 1 / v, 0)
    const beta = Math.sqrt(s * r)
    const gamma = Math.max(Math.sqrt(Math.max(s / beta + beta / r - 2, 0)), 1e-3)
    return [mu, beta, gamma]
  }

  _generator () {
    // Direct sampling by transforming a standard normal variate
    const n = this.p.gamma * normal(this.r, 0, 1)
    return this.p.beta * 0.25 * Math.pow(n + Math.sqrt(4 + Math.pow(n, 2)), 2) + this.p.mu
  }

  _pdf (x) {
    // Standard-normal density inlined (Normal.prototype._pdf read this.p.mu/this.p.sigma, no longer set)
    const z = Math.sqrt((x - this.p.mu) / this.p.beta)
    const w = (z - 1 / z) / this.p.gamma
    const phi = Math.exp(-0.5 * w * w) / this.c.sigmaRoot2Pi
    return (z + 1 / z) * phi / (2 * this.p.gamma * (x - this.p.mu))
  }

  _cdf (x) {
    // Standard-normal CDF inlined (Normal.prototype._cdf read this.p.mu/this.p.sigma, no longer set)
    const z = Math.sqrt((x - this.p.mu) / this.p.beta)
    return 0.5 * erfc(-(z - 1 / z) / (this.p.gamma * this.c.sigmaRoot2))
  }

  _q (p) {
    const n = this.p.gamma * this.c.sigmaRoot2 * erfinv(2 * p - 1)
    return this.p.beta * 0.25 * Math.pow(n + Math.sqrt(4 + Math.pow(n, 2)), 2) + this.p.mu
  }

  /**
   * @returns {number} Mean of the distribution.
   */
  mean () {
    const { mu, beta, gamma: gam } = this.p
    return mu + beta * (1 + gam * gam / 2)
  }

  /**
   * @returns {number} Variance of the distribution.
   */
  variance () {
    const { beta, gamma: gam } = this.p
    const g2 = gam * gam
    return beta * beta * g2 * (1 + 5 * g2 / 4)
  }

  /**
   * @returns {number} Skewness of the distribution.
   */
  skewness () {
    const g2 = this.p.gamma * this.p.gamma
    return 4 * this.p.gamma * (11 * g2 + 6) / Math.pow(5 * g2 + 4, 1.5)
  }

  /**
   * @returns {number} Excess kurtosis of the distribution.
   */
  kurtosis () {
    const g2 = this.p.gamma * this.p.gamma
    return 6 * g2 * (93 * g2 + 41) / Math.pow(5 * g2 + 4, 2)
  }
}
