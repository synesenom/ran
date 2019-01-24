/**
 * Generates a normally distributed value.
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
 * Generates a gamma distributed value.
 *
 * @method gamma
 * @memberOf ran.dist
 * @param alpha {number} Shape parameter.
 * @param beta {number} Rate parameter.
 * @returns {number} Random variate.
 * @private
 */
export function gamma (alpha, beta) {
  if (alpha > 1) {
    let d = alpha - 1 / 3

    let c = 1 / Math.sqrt(9 * d)

    let Z; let V; let U

    // Max 1000 trials
    for (let trials = 0; trials < 1000; trials++) {
      Z = normal(0, 1)
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
