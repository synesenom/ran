import { MAX_ITER } from '../special/_core'
import gammaLn from '../special/log-gamma'

/**
 * Performs a rejection sampling.
 *
 * @method rejection
 * @memberOf ran.dist
 * @param r {ran.core.Xoshiro128p} Random generator.
 * @param {Function} g Generator for the sample (major function).
 * @param {Function} accept The function that returns the acceptance threshold.
 * @param {Function} transform Optional transformation to apply once the sample is accepted (for transformed distributions).
 * @return {(number|undefined)} The sampled random variate.
 * @private
 */
export function rejection (r, g, accept, transform) {
  for (let trial = 0; trial < MAX_ITER; trial++) {
    let x = g()
    if (r.next() < accept(x)) {
      return typeof transform !== 'undefined' ? transform(x) : x
    }
  }
  return undefined
}

export function aliasTable (w) {
  // Pre-compute tables
  let n = w.length

  let prob = [0]

  let alias = [0]

  let total = 0
  if (w.length > 1) {
    // Get sum (for normalization)
    for (let i = 0; i < n; i++) { total += w[i] }

    // Fill up small and large work lists
    let p = []

    let small = []

    let large = []
    for (let i = 0; i < n; i++) {
      p.push(n * w[i] / total)
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

  // Return table
  return {
    prob, alias, normalizedWeights: w.map(d => d / total)
  }
}

/**
 * Generates a exponential random variate.
 *
 * @method exponential
 * @memberOf ran.dist
 * @param r {ran.core.Xoshiro128p} Random generator.
 * @param lambda {number=} Rate parameter. Default value is 1.
 * @returns {number} Random variate.
 * @private
 */
export function exponential (r, lambda = 1) {
  return -Math.log(r.next()) / lambda
}

/**
 * Generates a gamma random variate with the rate parametrization.
 *
 * @method gamma
 * @memberOf ran.dist
 * @param r {ran.core.Xoshiro128p} Random generator.
 * @param alpha {number} Shape parameter.
 * @param beta {number=} Rate parameter. Default value is 1.
 * @returns {number} Random variate.
 * @private
 */
export function gamma (r, alpha, beta = 1) {
  if (alpha > 1) {
    let d = alpha - 1 / 3

    let c = 1 / Math.sqrt(9 * d)

    let Z
    let V
    let U

    // Max 1000 trials
    for (let trials = 0; trials < 1000; trials++) {
      Z = normal(r)
      if (Z > -1 / c) {
        V = Math.pow(1 + c * Z, 3)
        U = r.next()
        if (Math.log(U) < 0.5 * Z * Z + d * (1 - V + Math.log(V))) { return d * V / beta }
      }
    }
  } else {
    return gamma(r, alpha + 1, beta) * Math.pow(r.next(), 1 / alpha)
  }
}

/**
 * Generates a normally random variate.
 *
 * @method normal
 * @memberOf ran.dist
 * @param r {ran.core.Xoshiro128p} Random generator.
 * @param mu {number=} Distribution mean. Default value is 0.
 * @param sigma {number=} Distribution standard deviation. Default value is 1.
 * @returns {number} Random variate.
 * @private
 */
export function normal (r, mu = 0, sigma = 1) {
  let u = r.next()

  let v = r.next()
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mu
}

/**
 * Generates a Poisson random variate.
 *
 * @method poisson
 * @memberOf ran.dist
 * @param r {ran.core.Xoshiro128p} Random generator.
 * @param {number} lambda Mean of the distribution.
 * @returns {number} Random variate.
 * @private
 */
export function poisson (r, lambda) {
  if (lambda < 30) {
    // Small lambda, Knuth's method
    let l = Math.exp(-lambda)

    let k = 0

    let p = 1
    do {
      k++
      p *= r.next()
    } while (p > l)
    return k - 1
  } else {
    // Large lambda, normal approximation
    let c = 0.767 - 3.36 / lambda

    let beta = Math.PI / Math.sqrt(3 * lambda)

    let alpha = beta * lambda

    let k = Math.log(c) - lambda - Math.log(beta)

    // Max 1000 trials
    for (let trials = 0; trials < 1000; trials++) {
      let u, x, n
      do {
        u = r.next()
        x = (alpha - Math.log((1 - u) / u)) / beta
        n = Math.floor(x + 0.5)
      } while (n < 0)
      let v = r.next()

      let y = alpha - beta * x

      let lhs = y + Math.log(v / Math.pow(1.0 + Math.exp(y), 2))

      let rhs = k + n * Math.log(lambda) - gammaLn(n + 1)
      if (lhs <= rhs) { return n }
    }
  }
}

/**
 * Generates a random sign.
 *
 * @method sign
 * @memberOf ran.dist
 * @param r {ran.core.Xoshiro128p} Random generator.
 * @param {number=} p Probability of +1. Default value is 0.5.
 * @return {number} Random sign (-1 or +1).
 * @private
 */
export function sign (r, p = 0.5) {
  return r.next() < p ? 1 : -1
}

/**
 * Generates a zeta random variate
 *
 * @method zeta
 * @memberOf ran.dist
 * @param r {ran.core.Xoshiro128p} Random generator.
 * @param {number} s Exponent.
 * @returns {number} Random variate.
 * @private
 */
export function zeta (r, s) {
  // Rejection sampling
  let b = Math.pow(2, s - 1)
  for (let trials = 0; trials < 100; trials++) {
    let x = Math.floor(Math.pow(r.next(), -1 / (s - 1)))
    let t = Math.pow(1 + 1 / x, s - 1)
    if (r.next() * x * (t - 1) / (b - 1) <= t / b) {
      return x
    }
  }
}
