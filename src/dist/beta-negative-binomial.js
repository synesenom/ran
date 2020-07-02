import logBeta from '../special/log-beta'
import PreComputed from './_pre-computed'
import Distribution from './_distribution'
import { beta as rBeta, gamma, poisson } from './_core'

export default class extends PreComputed {
  constructor (r = 10, alpha = 1, beta = 1) {
    super()

    // Validate parameters
    const ri = Math.round(r)
    this.p = { r: ri, alpha, beta }
    Distribution.validate({ r: ri, alpha, beta }, [
      'r > 0',
      'alpha > 0',
      'beta > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // TODO Speed-up constants
  }

  _pk (k) {
    if (k === 0) {
      // return Math.exp(logGamma(this.p.r + k) - logGamma(k + 1) - logGamma(this.p.r) + logBeta(this.p.alpha + this.p.r, this.p.beta + k) - logBeta(this.p.alpha, this.p.beta))
      return Math.exp(logBeta(this.p.alpha + this.p.r, this.p.beta) - logBeta(this.p.alpha, this.p.beta))
    }

    return this.pdfTable[k - 1] * (this.p.r + k - 1) * (this.p.beta + k - 1) / (k * (this.p.alpha + this.p.r + this.p.beta + k - 1))
    // return this.pdfTable[k - 1] * (k + this.p.r - 1) * (k + (this.p.alpha - 1)) / (k * (k + this.p.alpha + this.p.beta + this.p.r - 1))
    // return Math.exp(logGamma(this.p.r + k) - logGamma(k + 1) - logGamma(this.p.r) + logBeta(this.p.alpha + this.p.r, this.p.beta + k) - logBeta(this.p.alpha, this.p.beta))
  }

  // TODO Direct sampling
  _generator () {
    // Direct sampling by compounding beta and negative binomial
    const p = rBeta(this.r, this.p.alpha, this.p.beta)
    return poisson(this.r, gamma(this.r, this.p.r, 1 / p - 1))
  }
}
