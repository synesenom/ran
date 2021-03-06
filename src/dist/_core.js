import { MAX_ITER } from '../special/_core'
import gammaLn from '../special/log-gamma'

/**
 * Performs a rejection sampling.
 *
 * @method rejection
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {Function} g Generator for the sample (major function).
 * @param {Function} accept The function that returns the acceptance threshold.
 * @param {?Function} transform Optional transformation to apply once the sample is accepted (for transformed distributions).
 * @return {(number|undefined)} The sampled random variate.
 * @ignore
 */
export function rejection (r, g, accept, transform) {
  for (let trial = 0; trial < MAX_ITER; trial++) {
    const x = g()
    if (r.next() < accept(x)) {
      return typeof transform !== 'undefined' ? transform(x) : x
    }
  }
}

export function beta (r, a, b) {
  const x = gamma(r, a, 1)
  const y = gamma(r, b, 1)
  const z = x / (x + y)

  // Handle 1 - z << 1 case
  return Math.abs(1 - z) < Number.EPSILON ? 1 - y / x : z
}

/**
 * Generates a chi2 random variate.
 *
 * @method chi2
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} nu Degrees of freedom.
 * @returns {number} Random variate.
 * @ignore
 */
export function chi2 (r, nu) {
  return gamma(r, nu / 2, 0.5)
}

/**
 * Generates a exponential random variate.
 *
 * @method exponential
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} lambda Rate parameter. Default value is 1.
 * @returns {number} Random variate.
 * @ignore
 */
export function exponential (r, lambda = 1) {
  return -Math.log(r.next()) / lambda
}

/**
 * Generates a gamma random variate with the rate parametrization.
 *
 * @method gamma
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} a Shape parameter.
 * @param {number=} b Rate parameter. Default value is 1.
 * @returns {number} Random variate.
 * @ignore
 */
export function gamma (r, a, b = 1) {
  if (a > 1) {
    const d = a - 1 / 3

    const c = 1 / Math.sqrt(9 * d)

    let Z
    let V
    let U

    // Max 1000 trials
    for (let trials = 0; trials < 1000; trials++) {
      Z = normal(r)
      if (Z > -1 / c) {
        V = Math.pow(1 + c * Z, 3)
        U = r.next()
        if (Math.log(U) < 0.5 * Z * Z + d * (1 - V + Math.log(V))) { return d * V / b }
      }
    }
  } else {
    return gamma(r, a + 1, b) * Math.pow(r.next(), 1 / a)
  }
}

/**
 * Generates a non-central chi2 random variate.
 *
 * @method noncentralChi2
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} k Degrees of freedom.
 * @param {number} lambda Non-centrality parameter.
 * @returns {number} Random variate.
 * @ignore
 */
export function noncentralChi2 (r, k, lambda) {
  // Generated by a compound Poisson
  const j = poisson(r, lambda / 2)
  return gamma(r, k / 2 + j, 0.5)
}

/**
 * Generates a normally distributed random variate.
 *
 * @method normal
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} mu Distribution mean. Default value is 0.
 * @param {number=} sigma Distribution standard deviation. Default value is 1.
 * @returns {number} Random variate.
 * @ignore
 */
export function normal (r, mu = 0, sigma = 1) {
  const u = r.next()

  const v = r.next()
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mu
}

/**
 * Generates a Poisson random variate.
 *
 * @method poisson
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} lambda Mean of the distribution.
 * @returns {number} Random variate.
 * @ignore
 */
export function poisson (r, lambda) {
  if (lambda < 30) {
    // Small lambda, Knuth's method
    const l = Math.exp(-lambda)

    let k = 0

    let p = 1
    do {
      k++
      p *= r.next()
    } while (p > l)
    return k - 1
  } else {
    // Large lambda, normal approximation
    const c = 0.767 - 3.36 / lambda

    const b = Math.PI / Math.sqrt(3 * lambda)

    const alpha = b * lambda

    const k = Math.log(c) - lambda - Math.log(b)

    // Max 1000 trials
    for (let trials = 0; trials < 1000; trials++) {
      let u, x, n
      do {
        u = r.next()
        x = (alpha - Math.log((1 - u) / u)) / b
        n = Math.floor(x + 0.5)
      } while (n < 0)
      const v = r.next()

      const y = alpha - b * x

      const lhs = y + Math.log(v / Math.pow(1.0 + Math.exp(y), 2))

      const rhs = k + n * Math.log(lambda) - gammaLn(n + 1)
      if (lhs <= rhs) { return n }
    }
  }
}

/**
 * Generates a random sign.
 *
 * @method sign
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} p Probability of +1. Default value is 0.5.
 * @return {number} Random sign (-1 or +1).
 * @ignore
 */
export function sign (r, p = 0.5) {
  return r.next() < p ? 1 : -1
}

/**
 * Generates a zeta random variate
 *
 * @method zeta
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} s Exponent.
 * @returns {number} Random variate.
 * @ignore
 */
export function zeta (r, s) {
  // Rejection sampling
  const b = Math.pow(2, s - 1)
  for (let trials = 0; trials < 100; trials++) {
    const x = Math.floor(Math.pow(r.next(), -1 / (s - 1)))
    const t = Math.pow(1 + 1 / x, s - 1)
    if (r.next() * x * (t - 1) / (b - 1) <= t / b) {
      return x
    }
  }
}
