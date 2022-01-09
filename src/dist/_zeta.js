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
export default function (r, s) {
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
