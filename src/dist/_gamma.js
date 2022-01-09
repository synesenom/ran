import normal from './_normal'

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
export default function gamma (r, a, b = 1) {
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
