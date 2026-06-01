import { EPS } from '../core/constants'
import neumaier from './neumaier'

const MAX_LEVELS = 7

/**
 * Computes the definite integral of f over [a, b] using the double-exponential
 * (tanh-sinh) transformation. Achieves machine-epsilon precision in ~7 levels
 * for smooth integrands and naturally handles endpoint singularities.
 *
 * @method tanhSinh
 * @memberof ran.algorithms
 * @param {Function} f Integrand.
 * @param {number} a Lower bound.
 * @param {number} b Upper bound.
 * @return {number} Approximate integral.
 * @private
 */
export default function (f, a, b) {
  const mid = (a + b) / 2
  const halfLen = (b - a) / 2

  // Weight: halfLen * (π/2 · cosh(t)) / cosh²(π/2 · sinh(t)).
  // Returns 0 when cosh² overflows (t ≳ 6.1 for double precision), signaling
  // that all remaining nodes contribute nothing and the loop can stop.
  const w = t => {
    const u = Math.PI / 2 * Math.sinh(t)
    const cu = Math.cosh(u)
    return halfLen * (Math.PI / 2 * Math.cosh(t)) / (cu * cu)
  }

  const xNode = t => mid + halfLen * Math.tanh(Math.PI / 2 * Math.sinh(t))

  // Level 0: nodes at t = 0, ±1, ±2, … until weight underflows to 0.
  const terms = [w(0) * f(xNode(0))]
  for (let j = 1; ; j++) {
    const wj = w(j)
    if (wj === 0) break
    terms.push(wj * f(xNode(j)), wj * f(xNode(-j)))
  }
  let S = neumaier(terms)

  for (let k = 1; k <= MAX_LEVELS; k++) {
    const h = 1 / (1 << k)
    // New nodes are the odd multiples of h not present at the previous level.
    const newTerms = []
    for (let j = 1; ; j += 2) {
      const t = j * h
      const wt = w(t)
      if (wt === 0) break
      newTerms.push(wt * f(xNode(t)), wt * f(xNode(-t)))
    }
    // neumaier([]) → NaN; guard fires when all level-k nodes underflow immediately.
    // See solutions/algorithm/2026-06-01-1002-tanh-sinh-neumaier-empty-array-and-trap-replacement.md
    const Snew = S / 2 + (newTerms.length > 0 ? h * neumaier(newTerms) : 0)
    if (Math.abs(Snew - S) <= EPS * Math.abs(Snew)) {
      return Snew
    }
    S = Snew
  }
  return S
}
