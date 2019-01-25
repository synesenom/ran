import { normal, gamma, Distribution } from './core'
import * as special from '../special'
import { sum, neumaier } from '../utils'

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
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }
}

/**
 * Generator for the [generalized arcsine distribution]{@link https://en.wikipedia.org/wiki/Arcsine_distribution#Arbitrary_bounded_support}:
 *
 * $$f(x; a, b) = \frac{1}{\pi \sqrt{(x -a) (b - x)}},$$
 *
 * where \(a, b \in \mathbb{R}\) and \(a < b\). Support: \(x \in [a, b]\).
 *
 * @class Arcsine
 * @memberOf ran.dist
 * @param {number=} a Lower boundary. Default value is 0.
 * @param {number=} b Upper boundary. Default value is 1.
 * @constructor
 */
export class Arcsine extends Distribution {
  constructor (a = 0, b = 1) {
    super('continuous', arguments.length)
    this.p = { a, b }
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]
    this.c = [1 / Math.PI, b - a]
  }

  _generator () {
    // Inverse transform sampling
    let s = Math.sin(0.5 * Math.PI * Math.random())
    return (s * s) * this.c[1] + this.p.a
  }

  _pdf (x) {
    return this.c[0] / Math.sqrt((x - this.p.a) * (this.p.b - x))
  }

  _cdf (x) {
    return 2 * this.c[0] * Math.asin(Math.sqrt((x - this.p.a) / (this.p.b - this.p.a)))
  }
}

/**
 * Generator for the [Bates distribution]{@link https://en.wikipedia.org/wiki/Bates_distribution}:
 *
 * $$f(x; n, a, b) = \frac{n}{(b - a)(n - 1)!} \sum_{k = 0}^{\lfloor nz \rfloor} (-1)^k \begin{pmatrix}n \\ k \\ \end{pmatrix} (nz - k)^{n - 1},$$
 *
 * with \(z = \frac{x - a}{b - a}\), \(n \in \mathbb{N}_0\) and \(a, b \in \mathbb{R}, a < b\). Support: \(x \in [a, b]\).
 *
 * @class Bates
 * @memberOf ran.dist
 * @param {number=} n Number of uniform variates to sum. Default value is 10.
 * @param {number=} a Lower boundary of the uniform variate. Default value is 0.
 * @param {number=} b Upper boundary of the uniform variate. Default value is 1.
 * @constructor
 */
export class Bates extends Distribution {
  constructor (n = 10, a = 0, b = 1) {
    super('continuous', arguments.length)
    this.p = { n: Math.round(n), a, b }
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]
    this.c = Array.from({ length: this.p.n + 1 }, (d, k) => special.gammaLn(k + 1) + special.gammaLn(this.p.n - k + 1))
  }

  _generator () {
    // Direct sampling
    return sum(Array.from({ length: this.p.n }, () => (this.p.b - this.p.a) * Math.random() + this.p.a)) / this.p.n
  }

  _pdf (x) {
    let y = (x - this.p.a) / (this.p.b - this.p.a)

    let nx = this.p.n * y
    return this.p.n * neumaier(Array.from({ length: Math.floor(nx) + 1 }, (d, k) => {
      let z = (this.p.n - 1) * Math.log(nx - k) + Math.log(this.p.n) - this.c[k]

      let s = k % 2 === 0 ? 1 : -1
      return s * Math.exp(z)
    })) / (this.p.b - this.p.a)
  }

  _cdf (x) {
    let y = (x - this.p.a) / (this.p.b - this.p.a)

    let nx = this.p.n * y
    return neumaier(Array.from({ length: Math.floor(nx) + 1 }, (d, k) => {
      let z = this.p.n * Math.log(nx - k) - this.c[k]

      let s = k % 2 === 0 ? 1 : -1
      return s * Math.exp(z)
    }))
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
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling
    return Math.random() < this.p.p ? 1 : 0
  }

  _pdf (x) {
    return x === 1 ? this.p.p : x === 0 ? 1 - this.p.p : 0
  }

  _cdf (x) {
    return 1 - this.p.p
  }
}

/**
 * Generator for the [beta distribution]{@link https://en.wikipedia.org/wiki/Beta_distribution}:
 *
 * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with \(\alpha, \beta \in \mathbb{R}^+\) and \(\mathrm{B}(\alpha, \beta)\) is the beta function.
 * Support: \(x \in [0, 1]\).
 *
 *
 * @class Beta
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @constructor
 */
export class Beta extends Distribution {
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length)
    this.p = { alpha, beta }
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: 1,
      closed: beta >= 1
    }]
    this.c = [special.beta(alpha, beta)]
  }

  _generator () {
    // Direct sampling from gamma
    let x = gamma(this.p.alpha, 1)

    let y = gamma(this.p.beta, 1)
    return x / (x + y)
  }

  _pdf (x) {
    return Math.pow(x, this.p.alpha - 1) * Math.pow(1 - x, this.p.beta - 1) / this.c[0]
  }

  _cdf (x) {
    return special.betaIncomplete(this.p.alpha, this.p.beta, x)
  }
}

/**
 * Generator for the [beta prime distribution]{@link https://en.wikipedia.org/wiki/Beta_prime_distribution} (also
 * known as inverted beta):
 *
 * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{-\alpha - \beta}}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with \(\alpha, \beta \in \mathbb{R}^+\) and \(\mathrm{B}(\alpha, \beta)\) is the beta function.
 * Support: \(x \in \mathbb{R}^+\).
 *
 *
 * @class BetaPrime
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 2.
 * @param {number=} beta Second shape parameter. Default value is 2.
 * @constructor
 */
export class BetaPrime extends Distribution {
  constructor (alpha = 2, beta = 2) {
    super('continuous', arguments.length)
    this.p = { alpha, beta }
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling from gamma
    return gamma(this.p.alpha, 1) / gamma(this.p.beta, 1)
  }

  _pdf (x) {
    return Math.pow(x, this.p.alpha - 1) * Math.pow(1 + x, -this.p.alpha - this.p.beta) / special.beta(this.p.alpha, this.p.beta)
  }

  _cdf (x) {
    return special.betaIncomplete(this.p.alpha, this.p.beta, x / (1 + x))
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
    this.p = { n: Math.round(n), p }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: this.p.n,
      closed: true
    }]
    this.c = [pp, this.p.n * pp]
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
    return Math.exp(special.gammaLn(this.p.n + 1) - special.gammaLn(x + 1) - special.gammaLn(this.p.n - x + 1) +
      x * Math.log(this.p.p) + (this.p.n - x) * Math.log(1 - this.p.p))
  }

  _cdf (x) {
    return special.betaIncomplete(this.p.n - x, 1 + x, 1 - this.p.p)
  }
}

/**
 * Generator for the [bounded Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution#Bounded_Pareto_distribution}:
 *
 * $$f(x; L, H, \alpha) = \frac{\alpha L^\alpha x^{-\alpha - 1}}{1 - \big(\frac{L}{H}\big)^\alpha},$$
 *
 * with \(L, H \in \mathbb{R}^+\), \(H > L\) and \(\alpha \in \mathbb{R}^+\). Support: \(x \in [L, H]\).
 *
 * @class BoundedPareto
 * @memberOf ran.dist
 * @param {number=} L Lower boundary. Default value is 1.
 * @param {number=} H Upper boundary. Default value is 10.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
export class BoundedPareto extends Distribution {
  constructor (L = 1, H = 10, alpha = 1) {
    super('continuous', arguments.length)
    this.p = { L, H, alpha }
    this.s = [{
      value: L,
      closed: true
    }, {
      value: H,
      closed: true
    }]
    this.c = [Math.pow(L, alpha), Math.pow(H, alpha), (1 - Math.pow(L / H, alpha))]
  }

  _generator () {
    // Inverse transform sampling
    return Math.pow((this.c[1] + Math.random() * (this.c[0] - this.c[1])) / (this.c[0] * this.c[1]), -1 / this.p.alpha)
  }

  _pdf (x) {
    return this.p.alpha * Math.pow(this.p.L / x, this.p.alpha) / (x * this.c[2])
  }

  _cdf (x) {
    return (1 - this.c[0] * Math.pow(x, -this.p.alpha)) / (1 - this.c[0] / this.c[1])
  }
}

/**
 * Generator for the [Burr distribution]{@link https://en.wikipedia.org/wiki/Burr_distribution} (also known as
 * Singh-Maddala distribution):
 *
 * $$f(x; c, k) = c k \frac{x^{c - 1}}{(1 + x^c)^{k + 1}},$$
 *
 * with \(c, k \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class Burr
 * @memberOf ran.dist
 * @param {number=} c First shape parameter. Default value is 1.
 * @param {number=} k Second shape parameter. Default value is 1.
 * @constructor
 */
export class Burr extends Distribution {
  constructor (c = 1, k = 1) {
    super('continuous', arguments.length)
    this.p = { c, k }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return Math.pow(Math.pow(1 - Math.random(), -1 / this.p.k) - 1, 1 / this.p.c)
  }

  _pdf (x) {
    return this.p.c * this.p.k * Math.pow(x, this.p.c - 1) / Math.pow(1 + Math.pow(x, this.p.c), this.p.k + 1)
  }

  _cdf (x) {
    return 1 - Math.pow(1 + Math.pow(x, this.p.c), -this.p.k)
  }
}

/**
 * Generator for the [Cauchy distribution]{@link https://en.wikipedia.org/wiki/Cauchy_distribution}:
 *
 * $$f(x; x_0, \gamma) = \frac{1}{\pi\gamma\bigg[1 + \Big(\frac{x - x_0}{\gamma}\Big)^2\bigg]}$$
 *
 * where \(x_0 \in \mathbb{R}\) and \(\gamma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class Cauchy
 * @memberOf ran.dist
 * @param {number=} x0 Location parameter. Default value is 0.
 * @param {number=} gamma Scale parameter. Default value is 1.
 * @constructor
 */
export class Cauchy extends Distribution {
  constructor (x0 = 0, gamma = 1) {
    super('continuous', arguments.length)
    this.p = { x0, gamma }
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
    this.c = [Math.PI * this.p.gamma]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (Math.random() - 0.5)))
  }

  _pdf (x) {
    let y = (x - this.p.x0) / this.p.gamma
    return 1 / (this.c[0] * (1 + y * y))
  }

  _cdf (x) {
    return 0.5 + Math.atan2(x - this.p.x0, this.p.gamma) / Math.PI
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
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Math.max(0, weights.length - 1),
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
      return 0
    }
    let i = Math.floor(Math.random() * this.p.n)
    if (Math.random() < this.c[0][i]) { return i } else { return this.c[1][i] }
  }

  _pdf (x) {
    if (this.p.n <= 1) {
      return x !== 0 ? 0 : 1
    } else {
      return this.c[2][x]
    }
  }

  _cdf (x) {
    if (this.p.n <= 1) {
      return x < 0 ? 0 : 1
    } else {
      return this.c[3][x]
    }
  }
}

/**
 * Generator for the [degenerate distribution]{@link https://en.wikipedia.org/wiki/Degenerate_distribution}:
 *
 * $$f(x; x_0) = \begin{cases}1 &\quad\text{if $x = x_0$}\\0 &\quad\text{otherwise}\\\end{cases},$$
 *
 * where \(x_0 \in \mathbb{R}\). Support: \(x \in \mathbb{R}\).
 *
 * @class Degenerate
 * @memberOf ran.dist
 * @param {number=} x0 Location of the distribution. Default value is 0.
 * @constructor
 */
export class Degenerate extends Distribution {
  constructor (x0 = 0) {
    super('continuous', arguments.length)
    this.p = { x0 }
    this.s = [{
      value: x0,
      closed: true
    }, {
      value: x0,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling
    return this.p.x0
  }

  _pdf (x) {
    return x === this.p.x0 ? 1 : 0
  }

  _cdf (x) {
    return x < this.p.x0 ? 0 : 1
  }
}

/**
 * Generator for the [exponential distribution]{@link https://en.wikipedia.org/wiki/Exponential_distribution}:
 *
 * $$f(x; \lambda) = \lambda e^{-\lambda x},$$
 *
 * with \(\lambda \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class Exponential
 * @memberOf ran.dist
 * @param {number=} lambda Rate parameter. Default value is 1.
 * @constructor
 */
export class Exponential extends Distribution {
  constructor (lambda = 1) {
    super('continuous', arguments.length)
    this.p = { lambda }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return -Math.log(Math.random()) / this.p.lambda
  }

  _pdf (x) {
    return this.p.lambda * Math.exp(-this.p.lambda * x)
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.lambda * x)
  }
}

/**
 * Generator for the [F distribution]{@link https://en.wikipedia.org/wiki/F-distribution}:
 *
 * $$f(x; d_1, d_2) = \frac{\sqrt{\frac{(d_1 x)^{d_1} d_2^{d_2}}{(d_1x + d_2)^{d_1 + d_2}}}}{x \mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$$
 *
 * with \(d_1, d_2 \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class F
 * @memberOf ran.dist
 * @param {number=} d1 First degree of freedom. Default value is 2.
 * @param {number=} d2 Second degree of freedom. Default value is 2.
 * @constructor
 */
export class F extends Distribution {
  constructor (d1 = 2, d2 = 2) {
    super('continuous', arguments.length)
    this.p = { d1: Math.round(d1), d2: Math.round(d2) }
    this.s = [{
      value: 0,
      closed: this.p.d1 !== 1
    }, {
      value: null,
      closed: false
    }]
    this.c = [special.beta(this.p.d1 / 2, this.p.d2 / 2), Math.pow(this.p.d2, this.p.d2)]
  }

  _generator () {
    // Direct sampling from gamma
    return this.p.d2 * gamma(this.p.d1 / 2, 1) / (this.p.d1 * gamma(this.p.d2 / 2, 1))
  }

  _pdf (x) {
    return Math.sqrt(Math.pow(this.p.d1 * x, this.p.d1) * this.c[1] / Math.pow(this.p.d1 * x + this.p.d2, this.p.d1 + this.p.d2)) / (x * this.c[0])
  }

  _cdf (x) {
    return special.betaIncomplete(this.p.d1 / 2, this.p.d2 / 2, this.p.d1 * x / (this.p.d1 * x + this.p.d2))
  }
}

/**
 * Generator for the [Frechet distribution]{@link https://en.wikipedia.org/wiki/Frechet_distribution}:
 *
 * $$f(x; \alpha, s, m) = \frac{\alpha z^{-1 -\alpha} e^{-z^{-\alpha}}}{s},$$
 *
 * with \(z = \frac{x - m}{s}\). and \(\alpha, s \in \mathbb{R}^+\), \(m \in \mathbb{R}\). Support: \(x \in \mathbb{R}, x > m\).
 *
 * @class Frechet
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} s Scale parameter. Default value is 1.
 * @param {number=} m Location parameter. Default value is 0.
 * @constructor
 */
export class Frechet extends Distribution {
  constructor (alpha = 1, s = 1, m = 0) {
    super('continuous', arguments.length)
    this.p = { alpha, s, m }
    this.s = [{
      value: m,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.m + this.p.s * Math.pow(-Math.log(Math.random()), -1 / this.p.alpha)
  }

  _pdf (x) {
    let z = (x - this.p.m) / this.p.s
    return this.p.alpha * Math.pow(z, -1 - this.p.alpha) * Math.exp(-Math.pow(z, -this.p.alpha)) / this.p.s
  }

  _cdf (x) {
    return Math.exp(-Math.pow((x - this.p.m) / this.p.s, -this.p.alpha))
  }
}

/**
 * Generator for the [gamma distribution]{@link https://en.wikipedia.org/wiki/Gamma_distribution} using the
 * shape/rate parametrization:
 *
 * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{\alpha - 1} e^{-\beta x},$$
 *
 * where \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class Gamma
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @constructor
 */
export class Gamma extends Distribution {
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length)
    this.p = { alpha, beta }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
    this.c = [Math.pow(beta, alpha), special.gamma(alpha)]
  }

  _generator () {
    // Direct sampling
    return gamma(this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    return this.c[0] * Math.exp((this.p.alpha - 1) * Math.log(x) - this.p.beta * x) / this.c[1]
  }

  _cdf (x) {
    return special.gammaLowerIncomplete(this.p.alpha, this.p.beta * x) / this.c[1]
  }
}

/**
 * Generator for the [\(\chi^2\) distribution]{@link https://en.wikipedia.org/wiki/Chi-squared_distribution}:
 *
 * $$f(x; k) = \frac{1}{2^{k/2} \Gamma(k/2)} x^{k/2 - 1} e^{-x/2},$$
 *
 * where \(k \in \mathbb{N}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class Chi2
 * @memberOf ran.dist
 * @param {number=} k Degrees of freedom. If not an integer, is rounded to the nearest one. Default value is 2.
 * @constructor
 */
export class Chi2 extends Gamma {
  // Special case of gamma
  constructor (k = 2) {
    super(Math.round(k) / 2, 0.5)
  }
}

/**
 * Generator for the [Erlang distribution]{@link https://en.wikipedia.org/wiki/Erlang_distribution}:
 *
 * $$f(x; k, \lambda) = \frac{\lambda^k x^{k - 1} e^{-\lambda x}}{(k - 1)!},$$
 *
 * where \(k \in \mathbb{N}^+\) and \(\lambda \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class Erlang
 * @memberOf ran.dist
 * @param {number=} k Shape parameter. It is rounded to the nearest integer. Default value is 1.
 * @param {number=} lambda Rate parameter. Default value is 1.
 * @constructor
 */
export class Erlang extends Gamma {
  // Special case of gamma
  constructor (k = 1, lambda = 1) {
    super(Math.round(k), lambda)
  }
}

/**
 * Generator for the [generalized gamma distribution]{@link https://en.wikipedia.org/wiki/Generalized_gamma_distribution}:
 *
 * $$f(x; a, d, p) = \frac{p/a^d}{\Gamma(d/p)} x^{d - 1} e^{-(x/a)^p},$$
 *
 * where \(a, d, p \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class GeneralizedGamma
 * @memberOf ran.dist
 * @param {number=} a Scale parameter. Default value is 1.
 * @param {number=} d Shape parameter. Default value is 1.
 * @param {number=} p Shape parameter. Default value is 1.
 * @constructor
 */
export class GeneralizedGamma extends Distribution {
  constructor (a = 1, d = 1, p = 1) {
    super('continuous', arguments.length)
    this.p = { a, d, p }
    this.s = [{
      value: 0,
      closed: d >= 1
    }, {
      value: null,
      closed: false
    }]
    this.c = [special.gamma(d / p), (p / Math.pow(a, d)), 1 / Math.pow(a, p)]
  }

  _generator () {
    // Direct sampling from gamma
    return Math.pow(gamma(this.p.d / this.p.p, this.c[2]), 1 / this.p.p)
  }

  _pdf (x) {
    return this.c[1] * Math.exp((this.p.d - 1) * Math.log(x) - Math.pow(x / this.p.a, this.p.p)) / this.c[0]
  }

  _cdf (x) {
    return special.gammaLowerIncomplete(this.p.d / this.p.p, Math.pow(x / this.p.a, this.p.p)) / this.c[0]
  }
}

/**
 * Generator for the [geometric distribution]{@link https://en.wikipedia.org/wiki/Geometric_distribution} (the number of
 * failures before the first success definition):
 *
 * $$f(k; p) = (1 - p)^k p,$$
 *
 * with \(p \in (0, 1]\). Support: \(k \in \{0, 1, 2, ...\}\).
 *
 * @class Geometric
 * @memberOf ran.dist
 * @param {number} p Probability of success. Default value is 0.5.
 * @constructor
 */
export class Geometric extends Distribution {
  constructor (p = 0.5) {
    super('discrete', arguments.length)
    this.p = { p }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return Math.floor(Math.log(Math.random()) / Math.log(1 - this.p.p))
  }

  _pdf (x) {
    return this.p.p * Math.pow(1 - this.p.p, x)
  }

  _cdf (x) {
    return 1 - Math.pow(1 - this.p.p, x + 1)
  }
}

/**
 * Generator for the [Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gompertz_distribution}:
 *
 * $$f(x; \eta, b) = b \eta e^{\eta + bx - \eta e^{bx}} ,$$
 *
 * with \(\eta, b \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class Gompertz
 * @memberOf ran.dist
 * @param {number=} eta Shape parameter. Default value is 1.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
export class Gompertz extends Distribution {
  constructor (eta = 1, b = 1) {
    super('continuous', arguments.length)
    this.p = { eta, b }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return Math.log(1 - Math.log(Math.random()) / this.p.eta) / this.p.b
  }

  _pdf (x) {
    return this.p.b * this.p.eta * Math.exp(this.p.eta + this.p.b * x - this.p.eta * Math.exp(this.p.b * x))
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.eta * (Math.exp(this.p.b * x) - 1))
  }
}

/**
 * Generator for the [Gumbel distribution]{@link https://en.wikipedia.org/wiki/Gumbel_distribution}:
 *
 * $$f(x; \mu, \beta) = \frac{1}{\beta} e^{-(z + e^-z)},$$
 *
 * with \(z = \frac{x - \mu}{\beta}\) and \(\mu \in \mathbb{R}\), \(\beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class Gumbel
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
export class Gumbel extends Distribution {
  constructor (mu = 0, beta = 1) {
    super('continuous', arguments.length)
    this.p = { mu, beta }
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.mu - this.p.beta * Math.log(-Math.log(Math.random()))
  }

  _pdf (x) {
    let z = (x - this.p.mu) / this.p.beta
    return Math.exp(-(z + Math.exp(-z))) / this.p.beta
  }

  _cdf (x) {
    return Math.exp(-Math.exp(-(x - this.p.mu) / this.p.beta))
  }
}

/**
 * Generator for the [inverse \(\chi^2\) distribution]{@link https://en.wikipedia.org/wiki/Inverse-chi-squared_distribution}:
 *
 * $$f(x; \nu) = \frac{2^{-\nu/2}}{\Gamma(\nu / 2)} x^{-\nu/2 - 1} e^{-1/(2x)},$$
 *
 * with \(\nu \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class InverseChi2
 * @memberOf ran.dist
 * @param {number=} nu Degrees of freedom. Default value is 1.
 * @constructor
 */
export class InverseChi2 extends Distribution {
  constructor (nu = 1) {
    super('continuous', arguments.length)
    this.p = { nu: Math.round(nu) }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling
    return 1 / gamma(Math.round(this.p.nu) / 2, 0.5)
  }

  _pdf (x) {
    return Math.pow(2, -this.p.nu / 2) * Math.pow(x, -this.p.nu / 2 - 1) * Math.exp(-0.5 / x) / special.gamma(this.p.nu / 2)
  }

  _cdf (x) {
    return 1 - special.gammaLowerIncomplete(this.p.nu / 2, 0.5 / x) / special.gamma(this.p.nu / 2)
  }
}

/**
 * Generator for the [inverse gamma distribution]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}:
 *
 * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{-\alpha - 1} e^{-\beta/x},$$
 *
 * where \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class InverseGamma
 * @memberOf ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
export class InverseGamma extends Distribution {
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length)
    this.p = { alpha, beta }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: null,
      closed: false
    }]
    this.c = [Math.pow(beta, alpha) / special.gamma(alpha), special.gamma(alpha)]
  }

  _generator () {
    // Direct sampling from gamma
    return 1 / gamma(this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    return this.c[0] * Math.pow(x, -1 - this.p.alpha) * Math.exp(-this.p.beta / x)
  }

  _cdf (x) {
    return 1 - special.gammaLowerIncomplete(this.p.alpha, this.p.beta / x) / this.c[1]
  }
}

/**
 * Generator for the Wald or [inverse Gaussian distribution]{@link https://en.wikipedia.org/wiki/Inverse_Gaussian_distribution}:
 *
 * $$f(x; \lambda, \mu) = \bigg[\frac{\lambda}{2 \pi x^3}\bigg]^{1/2} e^{\frac{-\lambda (x - \mu)^2}{2 \mu^2 x}},$$
 *
 * with \(\lambda, \mu \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class InverseGaussian
 * @memberOf ran.dist
 * @param {number=} lambda Shape parameter. Default value is 1.
 * @param {number=} mu Mean of the distribution. Default value is 1.
 * @constructor
 */
export class InverseGaussian extends Distribution {
  constructor (lambda = 1, mu = 1) {
    super('continuous', arguments.length)
    this.p = { lambda, mu }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
    this.c = [0.5 * this.p.mu / this.p.lambda, Math.exp(2 * lambda / mu)]
  }

  static _phi (x) {
    return 0.5 * (1 + special.erf(x / Math.SQRT2))
  }

  _generator () {
    // Direct sampling
    let nu = normal()

    let y = nu * nu

    let x = this.p.mu + this.c[0] * this.p.mu * y - this.c[0] * Math.sqrt(this.p.mu * y * (4 * this.p.lambda + this.p.mu * y))
    return Math.random() > this.p.mu / (this.p.mu + x) ? this.p.mu * this.p.mu / x : x
  }

  _pdf (x) {
    return Math.sqrt(this.p.lambda / (2 * Math.PI * Math.pow(x, 3))) * Math.exp(-this.p.lambda * Math.pow(x - this.p.mu, 2) / (2 * this.p.mu * this.p.mu * x))
  }

  _cdf (x) {
    let s = Math.sqrt(this.p.lambda / x)

    let t = x / this.p.mu
    return InverseGaussian._phi(s * (t - 1)) + this.c[1] * InverseGaussian._phi(-s * (t + 1))
  }
}

/**
 * Generator for the [Irwin-Hall distribution]{@link https://en.wikipedia.org/wiki/Irwin%E2%80%93Hall_distribution}:
 *
 * $$f(x; n) = \frac{1}{(n - 1)!} \sum_{k = 0}^{\lfloor x\rfloor} (-1)^k \begin{pmatrix}n \\ k \\ \end{pmatrix} (x - k)^{n - 1},$$
 *
 * with \(n \in \mathbb{N}_0\). Support: \(x \in [0, n]\).
 *
 * @class IrwinHall
 * @memberOf ran.dist
 * @param {number=} n Number of uniform variates to sum. Default value is 1.
 * @constructor
 */
// TODO improve summation in pdf/cdf
export class IrwinHall extends Distribution {
  constructor (n = 1) {
    super('continuous', arguments.length)
    this.p = { n: Math.round(n) }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: n,
      closed: true
    }]
    this.c = Array.from({ length: n + 1 }, (d, k) => special.gammaLn(k + 1) + special.gammaLn(n - k + 1))
  }

  _generator () {
    // Direct sampling
    return sum(Array.from({ length: this.p.n }, Math.random))
  }

  _pdf (x) {
    return neumaier(Array.from({ length: Math.floor(x) + 1 }, (d, k) => {
      let z = (this.p.n - 1) * Math.log(x - k) + Math.log(this.p.n) - this.c[k]

      let s = k % 2 === 0 ? 1 : -1
      return s * Math.exp(z)
    }))
  }

  _cdf (x) {
    return neumaier(Array.from({ length: Math.floor(x) + 1 }, (d, k) => {
      let z = this.p.n * Math.log(x - k) - this.c[k]

      let s = k % 2 === 0 ? 1 : -1
      return s * Math.exp(z)
    }))
  }
}

/**
 * Generator for the [Kumaraswamy distribution]{@link https://en.wikipedia.org/wiki/Kumaraswamy_distribution} (also
 * known as Minimax distribution):
 *
 * $$f(x; a, b) = a b x^{a-1} (1 - x^a)^{b - 1},$$
 *
 * with \(a, b \in \mathbb{R}^+\). Support: \(x \in (0, 1)\).
 *
 * @class Kumaraswamy
 * @memberOf ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @constructor
 */
export class Kumaraswamy extends Distribution {
  constructor (a = 1, b = 1) {
    super('continuous', arguments.length)
    this.p = { a, b }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return Math.pow(1 - Math.pow(1 - Math.random(), 1 / this.p.b), 1 / this.p.a)
  }

  _pdf (x) {
    return this.p.a * this.p.b * Math.pow(x, this.p.a - 1) * Math.pow(1 - Math.pow(x, this.p.a), this.p.b - 1)
  }

  _cdf (x) {
    return 1 - Math.pow(1 - Math.pow(x, this.p.a), this.p.b)
  }
}

/**
 * Generator for the [Laplace distribution]{@link https://en.wikipedia.org/wiki/Laplace_distribution}:
 *
 * $$f(x; \mu, b) = \frac{1}{2b}e^{-\frac{|x - \mu|}{b}},$$
 *
 * where \(\mu \in \mathbb{R}\) and \(b \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class Laplace
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} b Scale parameter. Default value is 1.
 * @constructor
 */
export class Laplace extends Distribution {
  constructor (mu = 0, b = 1) {
    super('continuous', arguments.length)
    this.p = { mu, b }
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling from uniform
    return this.p.b * Math.log(Math.random() / Math.random()) + this.p.mu
  }

  _pdf (x) {
    return 0.5 * Math.exp(-Math.abs(x - this.p.mu) / this.p.b) / this.p.b
  }

  _cdf (x) {
    let z = Math.exp((x - this.p.mu) / this.p.b)
    return x < this.p.mu ? 0.5 * z : 1 - 0.5 / z
  }
}

/**
 * Generator for the [log-Cauchy distribution]{@link https://en.wikipedia.org/wiki/Log-Cauchy_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\pi x}\bigg[\frac{\sigma}{(\ln x - \mu)^2 + \sigma^2}\bigg],$$
 *
 * with \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class LogCauchy
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export class LogCauchy extends Distribution {
  constructor (mu = 0, sigma = 1) {
    super('continuous', arguments.length)
    this.p = { mu, sigma }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return Math.exp(this.p.mu + this.p.sigma * Math.tan(Math.PI * (Math.random() - 0.5)))
  }

  _pdf (x) {
    return this.p.sigma / (x * Math.PI * (this.p.sigma * this.p.sigma + Math.pow(Math.log(x) - this.p.mu, 2)))
  }

  _cdf (x) {
    return 0.5 + Math.atan2(Math.log(x) - this.p.mu, this.p.sigma) / Math.PI
  }
}

/**
 * Generator for the [logistic distribution]{@link https://en.wikipedia.org/wiki/Logistic_distribution}:
 *
 * $$f(x; \mu, s) = \frac{e^{-z}}{s (1 + e^{-z})^2},$$
 *
 * with \(z = \frac{x - \mu}{s}\), \(\mu \in \mathbb{R}\) and \(s \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class Logistic
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} s Scale parameter. Default value is 1.
 * @constructor
 */
export class Logistic extends Distribution {
  constructor (mu = 0, s = 1) {
    super('continuous', arguments.length)
    this.p = { mu, s }
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.mu - this.p.s * Math.log(1 / Math.random() - 1)
  }

  _pdf (x) {
    let z = Math.exp(-(x - this.p.mu) / this.p.s)
    return z / (this.p.s * Math.pow(1 + z, 2))
  }

  _cdf (x) {
    return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.s))
  }
}

/**
 * Generator for the [shifted log-logistic distribution]{@link https://en.wikipedia.org/wiki/Shifted_log-logistic_distribution}:
 *
 * $$f(x; \mu, s) = \frac{e^{-z}}{s (1 + e^{-z})^2},$$
 *
 * with \(z = \frac{x - \mu}{\sigma}\), \(\mu, \xi \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \ge \mu-\sigma/\xi\) if \(\xi > 0\), \(x \le \mu-\sigma/\xi\) if \(\xi < 0\), \(x \in \mathbb{R}\) otherwise.
 *
 * @class LogLogistic
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @param {number=} xi Shape parameter. Default value is 1.
 * @constructor
 */
export class LogLogistic extends Distribution {
  constructor (mu = 0, sigma = 1, xi = 1) {
    super('continuous', arguments.length)
    this.p = { mu, sigma, xi }
    this.s = xi === 0 ? [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }] : [{
      value: xi > 0 ? mu - sigma / xi : null,
      closed: xi > 0
    }, {
      value: xi < 0 ? mu - sigma / xi : null,
      closed: xi < 0
    }]
  }

  _generator () {
    // Inverse transform sampling
    if (this.p.xi === 0) {
      // Fall back to logistic
      return this.p.mu - this.p.sigma * Math.log(1 / Math.random() - 1)
    } else {
      return this.p.mu + this.p.sigma * (Math.pow(1 / Math.random() - 1, -this.p.xi) - 1) / this.p.xi
    }
  }

  _pdf (x) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      let z = Math.exp(-(x - this.p.mu) / this.p.sigma)
      return z / (this.p.sigma * Math.pow(1 + z, 2))
    } else {
      let z = (x - this.p.mu) / this.p.sigma

      return Math.pow(1 + this.p.xi * z, -(1 / this.p.xi + 1)) / (this.p.sigma * Math.pow(1 + Math.pow(1 + this.p.xi * z, -1 / this.p.xi), 2))
    }
  }

  _cdf (x) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.sigma))
    } else {
      let z = (x - this.p.mu) / this.p.sigma

      return 1 / (1 + Math.pow(1 + this.p.xi * z, -1 / this.p.xi))
    }
  }
}

/**
 * Generator for the [lognormal distribution]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{x \sigma \sqrt{2 \pi}}e^{-\frac{(\ln x - \mu)^2}{2\sigma^2}},$$
 *
 * where \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class Lognormal
 * @memberOf ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export class Lognormal extends Distribution {
  constructor (mu = 0, sigma = 1) {
    super('continuous', arguments.length)
    this.p = { mu, sigma }
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: null,
      closed: false
    }]
    this.c = [sigma * Math.sqrt(2 * Math.PI), sigma * Math.SQRT2]
  }

  _generator () {
    // Direct sampling from normal
    return Math.exp(this.p.mu + this.p.sigma * normal(0, 1))
  }

  _pdf (x) {
    return Math.exp(-0.5 * Math.pow((Math.log(x) - this.p.mu) / this.p.sigma, 2)) / (x * this.c[0])
  }

  _cdf (x) {
    return 0.5 * (1 + special.erf((Math.log(x) - this.p.mu) / this.c[1]))
  }
}

/**
 * Generator for the [Lomax distribution]{@link https://en.wikipedia.org/wiki/Lomax_distribution}:
 *
 * $$f(x; \lambda, \alpha) = \frac{\alpha}{\lambda}\bigg[1 + \frac{x}{\lambda}\bigg]^{-(\alpha - 1)},$$
 *
 * with \(\lambda, \alpha \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class Lomax
 * @memberOf ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
export class Lomax extends Distribution {
  constructor (lambda = 1, alpha = 1) {
    super('continuous', arguments.length)
    this.p = { lambda, alpha }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.lambda * (Math.pow(Math.random(), -1 / this.p.alpha) - 1)
  }

  _pdf (x) {
    return this.p.alpha * Math.pow(1 + x / this.p.lambda, -1 - this.p.alpha) / this.p.lambda
  }

  _cdf (x) {
    return 1 - Math.pow(1 + x / this.p.lambda, -this.p.alpha)
  }
}

/**
 * Generator for the [Maxwell-Boltzmann distribution]{@link https://en.wikipedia.org/wiki/Maxwell%E2%80%93Boltzmann_distribution}:
 *
 * $$f(x; a) = \sqrt{\frac{2}{\pi}}\frac{x^2 e^{-x^2 / (2a^2)}}{a^3},$$
 *
 * with \(a \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
 *
 * @class MaxwellBoltzmann
 * @memberOf ran.dist
 * @param {number=} a Scale parameter. Default value is 1.
 * @constructor
 */
export class MaxwellBoltzmann extends Gamma {
  constructor (a = 1) {
    super(1.5, 2 * a * a)
  }
}

/**
 * Generator for the [normal distribution]{@link https://en.wikipedia.org/wiki/Normal_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\sqrt{2 \pi \sigma^2}} e^{-\frac{(x - \mu)^2}{2\sigma^2}},$$
 *
 * with \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
 *
 * @class Normal
 * @memberOf ran.dist
 * @param {number=} mu Location parameter (mean). Default value is 0.
 * @param {number=} sigma Squared scale parameter (variance). Default value is 1.
 * @constructor
 */
export class Normal extends Distribution {
  constructor (mu = 0, sigma = 1) {
    super('continuous', arguments.length)
    this.p = { mu, sigma }
    this.s = [{
      value: null,
      closed: false
    }, {
      value: null,
      closed: false
    }]
    this.c = [sigma * Math.sqrt(2 * Math.PI), sigma * Math.SQRT2]
  }

  _generator () {
    // Direct sampling
    return normal(this.p.mu, this.p.sigma)
  }

  _pdf (x) {
    return Math.exp(-0.5 * Math.pow((x - this.p.mu) / this.p.sigma, 2)) / this.c[0]
  }

  _cdf (x) {
    return 0.5 * (1 + special.erf((x - this.p.mu) / this.c[1]))
  }
}

/**
 * Generator for the [Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution}:
 *
 * $$f(x; x_\mathrm{min}, \alpha) = \frac{\alpha x_\mathrm{min}^\alpha}{x^{\alpha + 1}},$$
 *
 * with \(x_\mathrm{min}, \alpha \in \mathbb{R}^+\). Support: \(x \in [x_\mathrm{min}, \infty)\).
 *
 * @class Pareto
 * @memberOf ran.dist
 * @param {number=} xmin Scale parameter. Default value is 1.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
export class Pareto extends Distribution {
  constructor (xmin = 1, alpha = 1) {
    super('continuous', arguments.length)
    this.p = { xmin, alpha }
    this.s = [{
      value: xmin,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.xmin / Math.pow(Math.random(), 1 / this.p.alpha)
  }

  _pdf (x) {
    return this.p.alpha * Math.pow(this.p.xmin / x, this.p.alpha) / x
  }

  _cdf (x) {
    return 1 - Math.pow(this.p.xmin / x, this.p.alpha)
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
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
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
    return Math.pow(this.p.lambda, x) * Math.exp(-this.p.lambda) / special.gamma(x + 1)
  }

  _cdf (x) {
    return 1 - special.gammaLowerIncomplete(x + 1, this.p.lambda) / special.gamma(x + 1)
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
    this.s = [{
      value: -1,
      closed: true
    }, {
      value: 1,
      closed: true
    }]
  }

  _generator () {
    return Math.random() > 0.5 ? -1 : 1
  }

  _pdf (x) {
    return x === -1 || x === 1 ? 0.5 : 0
  }

  _cdf (x) {
    return x < -1 ? 0 : x >= 1 ? 1 : 0.5
  }
}

/**
 * Generator for the continuous
 * [uniform distribution]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}:
 *
 * $$f(x; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min}},$$
 *
 * with \(x_\mathrm{min}, x_\mathrm{max} \in \mathbb{R}\) and \(x_\mathrm{min} < x_\mathrm{max}\).
 * Support: \(x \in [x_\mathrm{min}, x_\mathrm{max}]\).
 *
 * @class UniformContinuous
 * @memberOf ran.dist
 * @param {number=} xmin Lower boundary. Default value is 0.
 * @param {number=} xmax Upper boundary. Default value is 1.
 * @constructor
 */
export class UniformContinuous extends Distribution {
  constructor (xmin = 0, xmax = 1) {
    super('continuous', arguments.length)
    this.p = { xmin, xmax }
    this.s = [{
      value: xmin,
      closed: true
    }, {
      value: xmax,
      closed: true
    }]
    this.c = [xmax - xmin]
  }

  _generator () {
    // Direct sampling
    return Math.random() * this.c[0] + this.p.xmin
  }

  _pdf (x) {
    return 1 / this.c[0]
  }

  _cdf (x) {
    return x > this.p.xmax ? 1 : (x - this.p.xmin) / this.c[0]
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
    this.p = { xmin: Math.round(xmin), xmax: Math.round(xmax) }
    this.s = [{
      value: this.p.xmin,
      closed: true
    }, {
      value: this.p.xmax,
      closed: true
    }]
    this.c = [this.p.xmax - this.p.xmin + 1]
  }

  _generator () {
    // Direct sampling
    return Math.floor(Math.random() * this.c[0]) + this.p.xmin
  }

  _pdf (x) {
    return 1 / this.c[0]
  }

  _cdf (x) {
    return (1 + x - this.p.xmin) / this.c[0]
  }
}

/**
 * Generator for the [Weibull distribution]{@link https://en.wikipedia.org/wiki/Weibull_distribution}:
 *
 * $$f(x; \lambda, k) = \frac{k}{\lambda}\bigg(\frac{x}{\lambda}\bigg)^{k - 1} e^{-(x / \lambda)^k},$$
 *
 * with \(\lambda, k \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class Weibull
 * @memberOf ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} k Shape parameter. Default value is 1.
 * @constructor
 */
export class Weibull extends Distribution {
  constructor (lambda = 1, k = 1) {
    super('continuous', arguments.length)
    this.p = { lambda, k }
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Inverse transform sampling
    return this.p.lambda * Math.pow(-Math.log(Math.random()), 1 / this.p.k)
  }

  _pdf (x) {
    return (this.p.k / this.p.lambda) * Math.exp((this.p.k - 1) * Math.log(x / this.p.lambda) - Math.pow(x / this.p.lambda, this.p.k))
  }

  _cdf (x) {
    return 1 - Math.exp(-Math.pow(x / this.p.lambda, this.p.k))
  }
}

/**
 * Generator for the [Rayleigh distribution]{@link https://en.wikipedia.org/wiki/Rayleigh_distribution}:
 *
 * $$f(x; \sigma) = \frac{x}{\sigma} e^{-\frac{x^2}{2\sigma^2}},$$
 *
 * with \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
 *
 * @class Rayleigh
 * @memberOf ran.dist
 * @param {number} sigma Scale parameter. Default value is 1.
 * @constructor
 */
export class Rayleigh extends Weibull {
  // Special case of Weibull
  constructor (sigma = 1) {
    super(sigma * Math.SQRT2, 2)
  }
}
