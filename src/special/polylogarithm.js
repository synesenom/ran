import wynnEpsilon from '../algorithms/wynn-epsilon'

/**
 * Computes the polylogarithm Li_n(z) = Σ_{k=1}^∞ z^k / k^n for integer n ≥ 1 and |z| < 1.
 *
 * @method polylogarithm
 * @memberof ran.special
 * @param {number} n Integer order (n ≥ 1).
 * @param {number} z Argument (|z| < 1).
 * @returns {number} Value of Li_n(z).
 * @private
 */
export default function polylogarithm (n, z) {
  // Li_1(z) = -ln(1-z) exactly; the general Wynn-epsilon series loses significant
  // accuracy near z=1 for n=1 (1/k per-term decay, the slowest of any order) -- issue #1414.
  // See solutions/testing/2026-08-31-0800-polylogarithm-grid-missing-real-caller-orders.md
  if (n === 1) {
    return -Math.log(1 - z)
  }
  let zk = 1
  return wynnEpsilon(k => {
    zk *= z
    return zk / Math.pow(k + 1, n)
  })
}
