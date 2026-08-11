import { logGamma } from '../special'

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
export default function (r, lambda) {
  // Reachable when a Beta-mixture caller's Beta draw provably underflows to exactly 0
  // (decisions/0054-boosted-gamma-analytic-underflow-boundary-return.md), driving a Gamma
  // rate to 0 and its mean (this function's lambda) to Infinity. The large-lambda branch
  // below divides by sqrt(lambda), silently producing NaN for lambda=Infinity and falling
  // off the end of the loop with no return -- an explicitly forbidden undefined sentinel.
  // The correctly-rounded answer for a Poisson process with infinite mean is Infinity
  // itself. (issue #1384)
  // See solutions/algorithm/2026-08-11-1830-boostedgamma-infinite-loop-and-downstream-boundary-cascade.md
  if (lambda === Infinity) {
    return Infinity
  }

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

      const rhs = k + n * Math.log(lambda) - logGamma(n + 1)
      if (lhs <= rhs) { return n }
    }
  }
}
