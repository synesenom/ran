import Distribution from './_distribution'
import PreComputed from './_pre-computed'
import poisson from './_poisson'

/**
 * Probability mass function for the [Pólya-Aeppli distribution]{@link https://arxiv.org/abs/1406.2780} (also known as geometric Poisson distribution):
 *
 * $f(k; \lambda, \theta) = \begin{cases}e^{-\lambda} &\quad\text{if $k = 0$},\\\\ e^{-\lambda} \sum_{j = 1}^k \frac{\lambda^j}{j!} \begin{pmatrix}k - 1 \\\\ j - 1 \\\\ \end{pmatrix} \theta^{k - j} (1 - \theta)^j &\quad\text{otherwise}\\\\ \end{cases},$
 *
 * where $\lambda > 0$ and $\theta \in (0, 1)$. Support: $k \in \mathbb{N}_0$.
 *
 * @class PolyaAeppli
 * @memberof ran.dist
 * @constructor
 */
export default class PolyaAeppli extends PreComputed {
  /**
   * @param {number} lambda Mean of the Poisson component.
   * @param {number} theta Parameter of the shifted geometric component.
   */
  constructor (lambda, theta) {
    // Using logarithmic probability mass values
    super(true)
    this.k = 2

    // Validate parameters
    this.p = { lambda, theta }
    Distribution.validate({ lambda, theta }, [
      'lambda > 0',
      'theta > 0', 'theta < 1'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Speed-up constants
    this.c = {
      logP1: Math.log(lambda * (1 - theta)) - lambda
    }
  }

  static _fitInit (data) {
    // Var/E = (1+theta)/(1-theta); solving gives theta = (ratio-1)/(ratio+1), lambda = E*(1-theta).
    const mean = data.reduce((s, x) => s + x, 0) / data.length
    const variance = data.reduce((s, x) => s + x * x, 0) / data.length - mean * mean
    if (variance <= mean) {
      return [Math.max(0.01, mean / 2), 0.5]
    }
    const ratio = variance / mean
    const theta = Math.max(0.01, Math.min(0.99, (ratio - 1) / (ratio + 1)))
    return [Math.max(0.01, mean * (1 - theta)), theta]
  }

  _pk (k) {
    if (k === 0) {
      return -this.p.lambda
    }

    if (k === 1) {
      return this.c.logP1
    }

    return this.pdfTable[k - 1] + Math.log((this.p.lambda * (1 - this.p.theta) + 2 * (k - 1) * this.p.theta - this.p.theta * this.p.theta * (k - 2) * Math.exp(this.pdfTable[k - 2] - this.pdfTable[k - 1])) / k)
  }

  _generator () {
    const N = poisson(this.r, this.p.lambda)
    let z = 0
    for (let i = 0; i < N; i++) {
      z += Math.floor(Math.log(this.r.next()) / Math.log(this.p.theta)) + 1
    }
    return Math.round(z)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return this.p.lambda / (1 - this.p.theta)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const { lambda, theta } = this.p
    return lambda * (1 + theta) / Math.pow(1 - theta, 2)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const { lambda, theta } = this.p
    const kappa2 = lambda * (1 + theta) / Math.pow(1 - theta, 2)
    const kappa3 = lambda * (1 + 4 * theta + theta * theta) / Math.pow(1 - theta, 3)
    return kappa3 / Math.pow(kappa2, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const { lambda, theta } = this.p
    const kappa2 = lambda * (1 + theta) / Math.pow(1 - theta, 2)
    const kappa4 = lambda * (1 + 11 * theta + 11 * theta * theta + theta * theta * theta) / Math.pow(1 - theta, 4)
    return kappa4 / (kappa2 * kappa2)
  }
}
