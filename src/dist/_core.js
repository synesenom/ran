import { gammaLn } from '../special'

/**
 * Performs a rejection sampling.
 *
 * @method rejection
 * @memberOf ran.dist
 * @param {Function} g Generator for the sample (major function).
 * @param {Function} accept The function that returns the acceptance threshold.
 * @return {?number} The sampled random variate.
 */
export function rejection (g, accept) {
  for (let trial = 0; trial < 1000; trial++) {
    let x = g()
    if (Math.random() < accept(x)) {
      return x
    }
  }
  return null
}

/**
 * Generates a exponential random variate.
 *
 * @method exponential
 * @memberOf ran.dist
 * @param lambda {number=} Rate parameter. Default value is 1.
 * @returns {number} Random variate.
 * @private
 */
export function exponential (lambda = 1) {
  return -Math.log(Math.random()) / lambda
}

/**
 * Generates a gamma random variate.
 *
 * @method gamma
 * @memberOf ran.dist
 * @param alpha {number} Shape parameter.
 * @param beta {number=} Rate parameter. Default value is 1.
 * @returns {number} Random variate.
 * @private
 */
export function gamma (alpha, beta = 1) {
  if (alpha > 1) {
    let d = alpha - 1 / 3

    let c = 1 / Math.sqrt(9 * d)

    let Z
    let V
    let U

    // Max 1000 trials
    for (let trials = 0; trials < 1000; trials++) {
      Z = normal()
      if (Z > -1 / c) {
        V = Math.pow(1 + c * Z, 3)
        U = Math.random()
        if (Math.log(U) < 0.5 * Z * Z + d * (1 - V + Math.log(V))) { return d * V / beta }
      }
    }
  } else {
    return gamma(alpha + 1, beta) * Math.pow(Math.random(), 1 / alpha)
  }
}

/**
 * Generates a normally random variate.
 *
 * @method normal
 * @memberOf ran.dist
 * @param mu {number=} Distribution mean. Default value is 0.
 * @param sigma {number=} Distribution standard deviation. Default value is 1.
 * @returns {number} Random variate.
 * @private
 */
export function normal (mu = 0, sigma = 1) {
  let u = Math.random()

  let v = Math.random()
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mu
}

/**
 * Generates a Poisson random variate.
 *
 * @method poisson
 * @memberOf ran.dist
 * @param {number} lambda Mean of the distribution.
 * @returns {number} Random variate.
 * @private
 */
export function poisson (lambda) {
  if (lambda < 30) {
    // Small lambda, Knuth's method
    let l = Math.exp(-lambda)

    let k = 0

    let p = 1
    do {
      k++
      p *= Math.random()
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
      let r, x, n
      do {
        r = Math.random()
        x = (alpha - Math.log((1 - r) / r)) / beta
        n = Math.floor(x + 0.5)
      } while (n < 0)
      let v = Math.random()

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
 * @param {number=} p Probability of +1. Default value is 0.5.
 * @return {number} Random sign (-1 or +1).
 * @private
 */
export function sign (p = 0.5) {
  return Math.random() < p ? 1 : -1
}

/**
 * Generates a zeta random variate
 *
 * @method zeta
 * @memberOf ran.dist
 * @param {number} s Exponent.
 * @returns {number} Random variate.
 * @private
 */
export function zeta (s) {
  // Rejection sampling
  let b = Math.pow(2, s - 1)
  for (let trials = 0; trials < 100; trials++) {
    let x = Math.floor(Math.pow(Math.random(), -1 / (s - 1)))
    let t = Math.pow(1 + 1 / x, s - 1)
    if (Math.random() * x * (t - 1) / (b - 1) <= t / b) {
      return x
    }
  }
}
