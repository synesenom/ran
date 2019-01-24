import Distribution from './distribution'
import * as special from '../special'

/**
 * Generator of an invalid (not implemented) distribution. Only for testing purposes.
 *
 * @class _InvalidDistribution
 * @memberOf ran.dist
 * @private
 */
export class _InvalidDistribution extends Distribution {
  constructor () {
    super('discrete', arguments.length)
  }
}

/**
 * Generator for the [Bernoulli distribution]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}:
 *
 * $$f(k; p) = \begin{cases}p &\quad\text{if $k = 1$},\\1 - p &\quad\text{if $k = 0$}\\\end{cases},$$
 *
 * where \(p \in [0, 1]\). Support: \(k \in \{0, 1\}\).
 *
 * @class Bernoulli
 * @memberOf ran.dist
 * @param {number=} p Probability of the outcome 1. Default value is 0.5.
 * @constructor
 */
export class Bernoulli extends Distribution {
  constructor (p = 0.5) {
    super('discrete', arguments.length)
    this.p = { p }
  }

  _generator () {
    // Direct sampling
    return Math.random() < this.p.p ? 1 : 0
  }

  _pdf (x) {
    let xi = parseInt(x)
    return xi === 1 ? this.p.p : xi === 0 ? 1 - this.p.p : 0
  }

  _cdf (x) {
    return x < 0 ? 0 : (parseInt(x) >= 1 ? 1 : 1 - this.p.p)
  }

  support () {
    return [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
  }
}

/**
 * Generator for the [binomial distribution]{@link https://en.wikipedia.org/wiki/Binomial_distribution}:
 *
 * $$f(k; n, p) = \begin{pmatrix}n \\ k \\ \end{pmatrix} p^k (1 - p)^{n - k},$$
 *
 * with \(n \in \mathbb{N}_0\) and \(p \in [0, 1]\). Support: \(k \in \{0, ..., n\}\).
 *
 * @class Binomial
 * @memberOf ran.dist
 * @param {number=} n Number of trials. Default value is 100.
 * @param {number=} p Probability of success. Default value is 0.5.
 * @constructor
 */
export class Binomial extends Distribution {
  constructor (n = 100, p = 0.5) {
    super('discrete', arguments.length)
    let pp = p <= 0.5 ? p : 1 - p
    this.p = { n, p }
    this.c = [pp, n * pp]
  }

  _generator () {
    // Direct sampling
    if (this.p.n < 25) {
      // Small n
      let b = 0
      for (let i = 1; i <= this.p.n; i++) {
        if (Math.random() < this.c[0]) b++
      }
      return this.c[0] === this.p.p ? b : this.p.n - b
    } else if (this.c[1] < 1.0) {
      // Small mean
      let lambda = Math.exp(-this.c[1])

      let t = 1.0; let i
      for (i = 0; i <= this.p.n; i++) {
        t *= Math.random()
        if (t < lambda) break
      }
      let b = Math.min(i, this.p.n)
      return this.c[0] === this.p.p ? b : this.p.n - b
    } else {
      // Rest of the cases
      let en = this.p.n

      let g = special.gammaLn(en + 1)

      let pc = 1 - this.c[0]

      let pLog = Math.log(this.c[0])

      let pcLog = Math.log(pc)

      let sq = Math.sqrt(2.0 * this.c[1] * pc)

      let y; let em; let t
      do {
        do {
          y = Math.tan(Math.PI * Math.random())
          em = sq * y + this.c[1]
        } while (em < 0.0 || em >= (en + 1.0))
        em = Math.floor(em)
        t = 1.2 * sq * (1.0 + y * y) * Math.exp(g - special.gammaLn(em + 1.0) -
          special.gammaLn(en - em + 1.0) + em * pLog + (en - em) * pcLog)
      } while (Math.random() > t)
      return this.c[0] === this.p.p ? em : this.p.n - em
    }
  }

  _pdf (x) {
    let xi = parseInt(x)
    return xi < 0 ? 0 : xi > this.p.n ? 0 : Math.exp(special.gammaLn(this.p.n + 1) - special.gammaLn(xi + 1) - special.gammaLn(this.p.n - xi + 1) +
      xi * Math.log(this.p.p) + (this.p.n - xi) * Math.log(1 - this.p.p))
  }

  _cdf (x) {
    let xi = parseInt(x)
    return xi < 0 ? 0 : xi >= this.p.n ? 1 : special.betaIncomplete(this.p.n - xi, 1 + xi, 1 - this.p.p)
  }

  support () {
    return [{
      value: 0,
      closed: true
    }, {
      value: this.p.n,
      closed: true
    }]
  }
}

/**
 * Generator for a custom distribution, using the
 * [alias table method]{@link http://www.keithschwarz.com/darts-dice-coins}:
 *
 * $$f(k; \{w\}) = \frac{w_k}{\sum_j w_j},$$
 *
 * where \(w_k \in \mathbb{R}^+\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class Custom
 * @memberOf ran.dist
 * @param {number[]} weights Weights for the distribution (doesn't need to be normalized). Default value is an array
 * with a single value of 1.
 * @constructor
 */
export class Custom extends Distribution {
  constructor (weights = [1]) {
    super('discrete', arguments.length)
    this.p = { n: weights.length, weights }

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
      return 0
    }
    let i = Math.floor(Math.random() * this.p.n)
    if (Math.random() < this.c[0][i]) { return i } else { return this.c[1][i] }
  }

  _pdf (x) {
    let xi = parseInt(x)
    if (this.p.n <= 1) {
      return xi !== 0 ? 0 : 1
    } else {
      return (xi < 0 || xi >= this.p.n) ? 0 : this.c[2][xi]
    }
  }

  _cdf (x) {
    let xi = parseInt(x)
    if (this.p.n <= 1) {
      return xi < 0 ? 0 : 1
    } else {
      return xi < 0 ? 0 : xi >= this.p.n ? 1 : this.c[3][xi]
    }
  }

  support () {
    return [{
      value: 0,
      closed: true
    }, {
      value: Math.max(0, this.p.n - 1),
      closed: true
    }]
  }
}

/**
 * Generator for the [Poisson distribution]{@link https://en.wikipedia.org/wiki/Poisson_distribution}:
 *
 * $$f(k; \lambda) = \frac{\lambda^k e^{-\lambda}}{k!},$$
 *
 * with \(\lambda \in \mathbb{R}^+\). Support: \(k \in \mathbb{N}_0\).
 *
 * @class Poisson
 * @memberOf ran.dist
 * @param {number=} lambda Mean of the distribution. Default value is 1.
 * @constructor
 */
export class Poisson extends Distribution {
  constructor (lambda = 1) {
    super('discrete', arguments.length)
    this.p = { lambda }
  }

  _generator () {
    // Direct sampling
    if (this.p.lambda < 30) {
      // Small lambda, Knuth's method
      let l = Math.exp(-this.p.lambda)

      let k = 0

      let p = 1
      do {
        k++
        p *= Math.random()
      } while (p > l)
      return k - 1
    } else {
      // Large lambda, normal approximation
      let c = 0.767 - 3.36 / this.p.lambda

      let beta = Math.PI / Math.sqrt(3 * this.p.lambda)

      let alpha = beta * this.p.lambda

      let k = Math.log(c) - this.p.lambda - Math.log(beta)
      // Max 1000 trials
      for (let trials = 0; trials < 1000; trials++) {
        let r, x, n
        do {
          r = Math.random()
          x = (alpha - Math.log((1 - r) / r)) / beta
          n = Math.floor(x + 0.5)
        } while (n < 0)
        let v = Math.random()

        let y = alpha - beta * x

        let lhs = y + Math.log(v / Math.pow(1.0 + Math.exp(y), 2))

        let rhs = k + n * Math.log(this.p.lambda) - special.gammaLn(n + 1)
        if (lhs <= rhs) { return n }
      }
    }
  }

  _pdf (x) {
    let xi = parseInt(x)
    return xi < 0 ? 0 : Math.pow(this.p.lambda, xi) * Math.exp(-this.p.lambda) / special.gamma(xi + 1)
  }

  _cdf (x) {
    let xi = parseInt(x)
    return xi < 0 ? 0 : 1 - special.gammaLowerIncomplete(xi + 1, this.p.lambda) / special.gamma(xi + 1)
  }

  support () {
    return [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }
}

/**
 * Generator for the [Rademacher distribution]{@link https://en.wikipedia.org/wiki/Rademacher_distribution}:
 *
 * $$f(k) = \begin{cases}1/2 &\quad\text{if $k = -1$},\\1/2 &\quad\text{if $k = 1$},\\0 &\quad\text{otherwise}.\\\end{cases}$$
 *
 * Support: \(k \in \{-1, 1\}\).
 *
 * @class Rademacher
 * @memberOf ran.dist
 * @constructor
 */
export class Rademacher extends Distribution {
  constructor () {
    super('discrete', arguments.length)
  }

  _generator () {
    return Math.random () > 0.5 ? -1 : 1
  }

  _pdf (x) {
    let xi = Math.round(x)
    return xi === -1 || xi === 1 ? 0.5 : 0
  }

  _cdf (x) {
    let xi = Math.round(x)
    return xi < -1 ? 0 : xi >= 1 ? 1 : 0.5
  }

  support () {
    return [{
      value: -1,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
  }
}

/**
 * Generator for the discrete
 * [uniform distribution]{@link https://en.wikipedia.org/wiki/Discrete_uniform_distribution}:
 *
 * $$f(k; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min} + 1},$$
 *
 * with \(x_\mathrm{min}, x_\mathrm{max} \in \mathbb{Z}\) and \(x_\mathrm{min} < x_\mathrm{max}\). Support: \(k \in \{x_\mathrm{min}, ..., x_\mathrm{max}\}\).
 *
 * @class UniformDiscrete
 * @memberOf ran.dist
 * @param {number=} xmin Lower boundary. Default value is 0.
 * @param {number=} xmax Upper boundary. Default value is 100.
 * @constructor
 */
export class UniformDiscrete extends Distribution {
  constructor (xmin = 0, xmax = 100) {
    super('discrete', arguments.length)
    this.p = { xmin, xmax }
    this.c = [xmax - xmin + 1]
  }

  _generator () {
    // Direct sampling
    return Math.floor(Math.random() * this.c[0]) + this.p.xmin
  }

  _pdf (x) {
    let xi = parseInt(x)
    return xi < this.p.xmin || xi > this.p.xmax ? 0 : 1 / this.c[0]
  }

  _cdf (x) {
    let xi = parseInt(x)
    return xi < this.p.xmin ? 0 : xi > this.p.xmax ? 1 : (1 + xi - this.p.xmin) / this.c[0]
  }

  support () {
    return [{
      value: this.p.xmin,
      closed: true
    }, {
      value: this.p.xmax,
      closed: true
    }]
  }
}
