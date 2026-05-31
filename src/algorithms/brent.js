import { EPS, MAX_ITER } from '../core/constants'

/**
 * Finds the root of a function using Brent's method.
 * Source: https://en.wikipedia.org/wiki/Brent%27s_method
 *
 * @method brent
 * @memberof ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {number} a0 Lower boundary of the bracket.
 * @param {number} b0 Upper boundary of the bracket.
 * @return {number} The root location if found, NaN otherwise.
 * @private
 */
// TODO Use pseudo code from wikipedia.
export default function (f, a0, b0) {
  let a = a0
  let b = b0
  let c = b0
  let d, e
  let fa = f(a)
  let fb = f(b)
  let fc, p, q, r, s, eps, xm

  if ((fa > 0 && fb > 0) || (fa < 0 && fb < 0)) {
    return NaN
  }

  fc = fb
  for (let k = 0; k < MAX_ITER; k++) {
    if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
      c = a
      fc = fa
      e = d = b - a
    }

    if (Math.abs(fc) < Math.abs(fb)) {
      a = b
      b = c
      c = a
      fa = fb
      fb = fc
      fc = fa
    }

    eps = EPS * (2 * Math.abs(b) + 0.5)
    xm = 0.5 * (c - b)

    if (Math.abs(xm) <= eps || fb === 0) {
      return b
    }
    if (Math.abs(e) >= eps && Math.abs(fa) > Math.abs(fb)) {
      s = fb / fa
      if (a === c) {
        p = 2 * xm * s
        q = 1 - s
      } else {
        q = fa / fc
        r = fb / fc
        p = s * (2 * xm * q * (q - r) - (b - a) * (r - 1))
        q = (q - 1) * (r - 1) * (s - 1)
      }
      if (p > 0) {
        q = -q
      }
      p = Math.abs(p)
      const min1 = 3 * xm * q - Math.abs(eps * q)
      const min2 = Math.abs(e * q)
      if (2 * p < (min1 < min2 ? min1 : min2)) {
        e = d
        d = p / q
      } else {
        d = xm
        e = d
      }
    } else {
      d = xm
      e = d
    }

    a = b
    fa = fb
    if (Math.abs(d) > eps) {
      b += d
    } else {
      b += eps * Math.sign(xm)
    }
    fb = f(b)
  }

  return NaN
}
