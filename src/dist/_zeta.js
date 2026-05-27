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
  // Rejection sampling — unbounded loop; acceptance rate is bounded away from 0
  // for all valid s > 1, so infinite regress is impossible.
  const b = Math.pow(2, s - 1)
  while (true) {
    const x = Math.floor(Math.pow(r.next(), -1 / (s - 1)))
    const t = Math.pow(1 + 1 / x, s - 1)
    if (r.next() * x * (t - 1) / (b - 1) <= t / b) {
      return x
    }
  }
}
