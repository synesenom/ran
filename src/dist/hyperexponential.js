import exponential from './_exponential'
import AliasTable from './_alias-table'
import Distribution from './_distribution'
import neumaier from '../algorithms/neumaier'

/**
 * Generator for the [hyperexponential distribution]{@link https://en.wikipedia.org/wiki/Hyperexponential_distribution}:
 *
 * $$f(x; \{w\}, \{\lambda\}) = \frac{1}{\sum_j w_j} \sum_i w_i \lambda_i e^{-\lambda_i x},$$
 *
 * where $w_i, \lambda_i > 0$. Support: $x \ge 0$.
 *
 * @class Hyperexponential
 * @memberof ran.dist
 * @param {Object[]=} parameters Array containing the rates and corresponding weights. Each array element must be an
 * object with twp properties: weight and rate. Default value is
 * <code>[{weight: 1, rate: 1}, {weight: 1, rate: 1}]</code>.
 * @constructor
 */
export default class extends Distribution {
  constructor (parameters = [{ weight: 1, rate: 1 }, { weight: 1, rate: 1 }]) {
    super('continuous', parameters.length)

    // Validate parameters
    const weights = parameters.map(d => d.weight)
    const norm = weights.reduce((acc, d) => d + acc, 0)
    this.p = Object.assign(this.p, {
      weights: weights.map(d => d / norm),
      rates: parameters.map(d => d.rate),
      n: weights.length
    })
    Distribution.validate({
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

    // Categorical generator for weight
    this.aliasTable = new AliasTable(parameters.map(d => d.weight))
  }

  _generator () {
    // Direct sampling
    const i = this.aliasTable.sample(this.r)
    return exponential(this.r, this.p.rates[i])
  }

  _pdf (x) {
    return neumaier(this.p.rates.map((d, i) => this.p.weights[i] * d * Math.exp(-d * x)))
  }

  _cdf (x) {
    return Math.min(neumaier(this.p.rates.map((d, i) => this.p.weights[i] * (1 - Math.exp(-d * x)))), 1)
  }
}
