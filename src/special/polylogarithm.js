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
  let zk = 1
  return wynnEpsilon(k => {
    zk *= z
    return zk / Math.pow(k + 1, n)
  })
}
