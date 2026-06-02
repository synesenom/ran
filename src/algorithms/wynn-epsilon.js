import { EPS, MAX_ITER, DELTA } from '../core/constants'

/**
 * Accelerates convergence of a series using Wynn's epsilon algorithm.
 * Works on both alternating and monotone convergent series without a fixed term limit.
 * The caller must pass signed terms; this function builds partial sums internally.
 *
 * @method wynnEpsilon
 * @memberof ran.algorithms
 * @param {Function} a Function returning the k-th signed term of the series (0-indexed).
 * @returns {number} Accelerated estimate of the series sum.
 * @private
 */
// See solutions/algorithm/2026-06-02-1130-wynn-epsilon-crz-replacement-and-signed-terms.md
export default function wynnEpsilon (a) {
  const e = []
  let S = 0
  let estimate = 0
  let estimateSet = false

  for (let n = 0; n < MAX_ITER; n++) {
    S += a(n)
    e.push(S)

    // Backward sweep: apply Wynn recurrence ε_{k+1}(n) = ε_{k-1}(n+1) + 1/(ε_k(n+1) - ε_k(n))
    // in-place. After the sweep, e[0] holds the latest diagonal entry.
    let tmp = 0
    for (let j = e.length - 1; j > 0; j--) {
      const diff = e[j] - e[j - 1]
      const save = e[j - 1]
      if (Math.abs(diff) <= DELTA) {
        // Near-zero denominator: if no even-diagonal estimate confirmed yet, partial sum is best fallback.
        return estimateSet ? estimate : S
      }
      e[j - 1] = tmp + 1 / diff
      tmp = save
    }

    // Even-diagonal entries (ε_{2m}(0)) appear at e[0] when e.length is odd; they are the
    // accelerated estimates. Check convergence only on these entries.
    if (e.length > 2 && e.length % 2 === 1) {
      if (Math.abs(e[0] - estimate) < EPS * Math.max(Math.abs(e[0]), 1)) {
        return e[0]
      }
      estimate = e[0]
      estimateSet = true
    }
  }
  return estimate
}
