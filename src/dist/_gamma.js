import normal from './_normal'

/**
 * Generates a gamma random variate with the rate parametrization.
 *
 * @method gamma
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} a Shape parameter.
 * @param {number} b Rate parameter.
 * @returns {number} Random variate.
 * @ignore
 */
export default function gamma (r, a, b = 1) {
  // Extra U^(1/a) draw in the boost branch pushed the a=1 KS statistic over
  // the p=0.01 threshold at N=10000 (issue #193); run M-T directly instead.
  // See solutions/distribution/2026-05-16-1851-gamma-sampler-boundary-α=1.md
  if (a >= 1) {
    const d = a - 1 / 3

    const c = 1 / Math.sqrt(9 * d)

    let Z
    let V
    let U

    // Unbounded loop; Marsaglia-Tsang acceptance rate exceeds 0.98 for a >= 1,
    // so the expected number of iterations is bounded and termination is guaranteed.
    while (true) {
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
