import { aliasTable, exponential } from './_core'
import Distribution from './_distribution'
import neumaier from '../algorithms/neumaier'

/**
 * Generator for the [hyperexponential distribution]{@link }:
 *
 * $$f(x; \{w\}, \{\lambda\}) = \frac{1}{\sum_j w_j} \sum_i w_i \lambda_i e^{-\lambda_i x},$$
 *
 * where \(w_i, \lambda_i > 0\). Support: \(x \ge 0\).
 *
 * @class Hyperexponential
 * @memberOf ran.dist
 * @param {Object[]} parameters Array containing the rates and corresponding weights. Each array element must be an object with twp properties: weight and rate. Default value is <code>[{weight: 1, rate: 1}, {weight: 1, rate: 1}]</code>.
 * @constructor
 */
export default class extends Distribution {
  constructor (parameters = [{weight: 1, rate: 1}, {weight: 1, rate: 1}]) {
    super('continuous', parameters.length)

    // Validate parameters
    let weights = parameters.map(d => d.weight)
    let norm = weights.reduce((acc, d) => d + acc, 0)
    this.p = Object.assign(this.p, {
      weights: weights.map(d => d / norm),
      rates: parameters.map(d => d.rate),
      n: weights.length
    })
    Distribution._validate({
      lambda_i: parameters.reduce((acc, d) => acc * d.rate, 1),
      n: weights.length
    }, [
      'lambda_i > 0',
      'n > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]

    // Categorical generator for speed up generation
    this.alias = aliasTable(parameters.map(d => d.weight))
  }

  _generator () {
    // Direct sampling
    let i = 0
    if (this.p.n > 1) {
      let j = Math.floor(this.r.next() * this.p.n)
      if (this.r.next() < this.alias.prob[j]) {
        i = j
      } else {
        i = this.alias.alias[j]
      }
    }
    return exponential(this.r, this.p.rates[i])
  }

  _pdf (x) {
    return neumaier(this.p.rates.map((d, i) => this.p.weights[i] * d * Math.exp(-d * x)))
  }

  _cdf (x) {
    return Math.min(neumaier(this.p.rates.map((d, i) => this.p.weights[i] * (1 - Math.exp(-d * x)))), 1)
  }
}
