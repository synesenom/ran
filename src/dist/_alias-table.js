/**
 * Class implementing an alias table with a sampler.
 *
 * @class AliasTable
 * @memberOf ran.dist
 * @param {number[]} weights The (unnormalized) weights for the alias table.
 * @constructor
 */
export default class {
  constructor (weights) {
    // Pre-compute tables
    this.n = weights.length

    this.prob = [0]

    this.alias = [0]

    let total = 0
    if (weights.length > 1) {
      // Get sum (for normalization)
      for (let i = 0; i < this.n; i++) { total += weights[i] }

      // Fill up small and large work lists
      let p = []

      let small = []

      let large = []
      for (let i = 0; i < this.n; i++) {
        p.push(this.n * weights[i] / total)
        if (p[i] < 1.0) { small.push(i) } else { large.push(i) }
      }

      // Init tables
      this.prob = []
      this.alias = []
      for (let i = 0; i < this.n; i++) {
        this.prob.push(1.0)
        this.alias.push(i)
      }

      // Fill up alias table
      let s = 0

      let l = 0
      while (small.length > 0 && large.length > 0) {
        s = small.shift()
        l = large.shift()

        this.prob[s] = p[s]
        this.alias[s] = l

        p[l] += p[s] - 1.0
        if (p[l] < 1.0) { small.push(l) } else { large.push(l) }
      }
      while (large.length > 0) {
        l = large.shift()
        this.prob[l] = 1.0
        this.alias[l] = l
      }
      while (small.length > 0) {
        s = small.shift()
        this.prob[s] = 1.0
        this.alias[s] = s
      }
    }

    // Normalized weights
    this.weights = weights.map(d => d / total)
  }

  /**
   * Returns a sample from the alias table.
   *
   * @method sample
   * @methodOf ran.dist.AliasTable
   * @param {ran.core.Xoshiro128p} r Pseudo random number generator to use.
   * @returns {number} The random sample.
   */
  sample (r) {
    if (this.n <= 1) {
      return 0
    }

    let i = Math.floor(r.next() * this.n)
    if (r.next() < this.prob[i]) {
      return i
    } else {
      return this.alias[i]
    }
  }

  /**
   * Returns the i-th weight of the alias table.
   *
   * @method weight
   * @methodOf ran.dist.AliasTable
   * @param {number} i Index of the weight to return.
   * @returns {number} The i-th weight.
   */
  weight (i) {
    return this.weights[i]
  }
}
