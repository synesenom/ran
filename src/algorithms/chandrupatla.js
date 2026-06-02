import { EPS, MAX_ITER } from '../core/constants'

/**
 * Finds the root of a function using Chandrupatla's hybrid bisection / inverse-quadratic-
 * interpolation method (T. R. Chandrupatla, Advances in Engineering Software 28.3, 1997).
 *
 * @method chandrupatla
 * @memberof ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {number} a0 Lower boundary of the bracket.
 * @param {number} b0 Upper boundary of the bracket.
 * @return {number} The root location. Best approximation after MAX_ITER iterations if convergence
 *   is not reached.
 * @throws {Error} If f(a0) and f(b0) have the same sign (bracket does not contain a root).
 * @private
 */
export default function (f, a0, b0) {
  const fa = f(a0)
  const fb = f(b0)

  // Early-returns before sign check: fa*fb>=0 would throw on exact endpoint roots — solutions/algorithm/2026-06-01-0210-chandrupatla-bracket-guard-and-brent-defects.md
  if (fa === 0) return a0
  if (fb === 0) return b0
  if (fa * fb > 0) {
    throw Error('chandrupatla: f(a) and f(b) must have opposite signs')
  }

  // b = best bracket endpoint (smallest |f|), c = other end, a = previous b
  let b = a0
  let fb2 = fa
  let c = b0
  let fc = fb
  if (Math.abs(fb2) > Math.abs(fc)) {
    b = b0
    fb2 = fb
    c = a0
    fc = fa
  }
  let a = b
  let fa2 = fb2

  for (let k = 0; k < MAX_ITER; k++) {
    if (Math.abs(c - b) <= 2 * EPS * Math.max(Math.abs(b), 1) || fb2 === 0) {
      return b
    }

    const xi = (a - b) / (c - b)
    const phi = (fa2 - fb2) / (fc - fb2)
    let t

    // Use inverse quadratic interpolation when the interpolated point lands safely inside bracket
    if ((1 - Math.sqrt(1 - xi)) < phi && phi < Math.sqrt(xi)) {
      t = fb2 / (fb2 - fc) * fa2 / (fa2 - fc) - xi * fb2 / (fa2 - fb2) * fc / (fc - fa2)
      t = Math.max(EPS, Math.min(1 - EPS, t))
    } else {
      t = 0.5
    }

    const xnew = b + t * (c - b)
    const fnew = f(xnew)

    a = b
    fa2 = fb2
    if (Math.sign(fnew) === Math.sign(fb2)) {
      b = xnew
      fb2 = fnew
    } else {
      c = xnew
      fc = fnew
    }

    // Maintain b = smallest |f| so IQI always interpolates from the best endpoint
    if (Math.abs(fc) < Math.abs(fb2)) {
      const tmp = b; b = c; c = tmp
      const ftmp = fb2; fb2 = fc; fc = ftmp
    }
  }

  return b
}
