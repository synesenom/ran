import Distribution from './_distribution'

/**
 * Generator for a [categorical distribution]{@link https://en.wikipedia.org/wiki/Categorical_distribution}:
 *
 * $$f(k; \{w\}) = \frac{w_k}{\sum_j w_j},$$
 *
 * where \(w_k \in \mathbb{R}^+ / \{0\}\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class Categorical
 * @memberOf ran.dist
 * @param {number[]=} weights Weights for the distribution (doesn't need to be normalized). Default value is an array with a single value of 1.
 * @param {number=} min Lowest value to sample (support starts at this value). Default value is 0.
 * @constructor
 */
export default class extends Distribution {
  constructor (weights = [1], min = 0) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { n: weights.length, weights, min }
    this._validate({ w_i: weights.reduce((acc, d) => acc * d, 1), min }, [
      'w_i >= 0'
    ])

    // Set support
    this.s = [{
      value: min,
      closed: true
    }, {
      value: Math.max(0, weights.length - 1) + min,
      closed: true
    }]

    // Pre-compute tables
    let n = weights.length

    let prob = [0]

    let alias = [0]

    let total = 0
    if (weights.length > 1) {
      // Get sum (for normalization)
      for (let i = 0; i < n; i++) { total += weights[i] }

      // Fill up small and large work lists
      let p = []

      let small = []

      let large = []
      for (let i = 0; i < n; i++) {
        p.push(n * weights[i] / total)
        if (p[i] < 1.0) { small.push(i) } else { large.push(i) }
      }

      // Init tables
      prob = []
      alias = []
      for (let i = 0; i < n; i++) {
        prob.push(1.0)
        alias.push(i)
      }

      // Fill up alias table
      let s = 0

      let l = 0
      while (small.length > 0 && large.length > 0) {
        s = small.shift()
        l = large.shift()

        prob[s] = p[s]
        alias[s] = l

        p[l] += p[s] - 1.0
        if (p[l] < 1.0) { small.push(l) } else { large.push(l) }
      }
      while (large.length > 0) {
        l = large.shift()
        prob[l] = 1.0
        alias[l] = l
      }
      while (small.length > 0) {
        s = small.shift()
        prob[s] = 1.0
        alias[s] = s
      }
    }

    // Build pmf and cdf
    let pmf = [weights[0] / total]

    let cdf = [weights[0] / total]
    for (let i = 1; i < weights.length; i++) {
      pmf.push(weights[i] / total)
      cdf.push(cdf[i - 1] + weights[i] / total)
    }

    // Assign to constants
    this.c = [prob, alias, pmf, cdf]
  }

  _generator () {
    // Direct sampling
    if (this.p.n <= 1) {
      return this.p.min
    }
    let i = Math.floor(this.r.next() * this.p.n)
    if (this.r.next() < this.c[0][i]) {
      return i + this.p.min
    } else {
      return this.c[1][i] + this.p.min
    }
  }

  _pdf (x) {
    if (this.p.n <= 1) {
      return 1
    } else {
      return this.c[2][x - this.p.min]
    }
  }

  _cdf (x) {
    return this.c[3][x - this.p.min]
  }
}
