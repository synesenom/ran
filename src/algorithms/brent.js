import { EPS, MAX_ITER } from '../special/_core'

/**
 * Finds the root of a function using Brent's method.
 * Source: https://en.wikipedia.org/wiki/Brent%27s_method
 *
 * @method brent
 * @methodOf ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {number} x1 Lower boundary of the bracket.
 * @param {number} x2 Upper boundary of the bracket.
 * @return {?number} The root location if found, undefined otherwise.
 * @private
 */
export default function (f, x1, x2) {
  let a = x1
  let b = x2
  let c = x2
  let d, e
  let fa = f(a)
  let fb = f(b)
  let fc, p, q, r, s, eps, xm

  if ((fa > 0.0 && fb > 0.0) || (fa < 0.0 && fb < 0.0)) {
    return undefined
  }

  fc = fb
  for (let k = 0; k < MAX_ITER; k++) {
    if ((fb > 0.0 && fc > 0.0) || (fb < 0.0 && fc < 0.0)) {
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

    eps = EPS * (2.0 * Math.abs(b) + 0.5)
    xm = 0.5 * (c - b)

    if (Math.abs(xm) <= eps || fb === 0.0) {
      return b
    }
    if (Math.abs(e) >= eps && Math.abs(fa) > Math.abs(fb)) {
      s = fb / fa
      if (a === c) {
        p = 2.0 * xm * s
        q = 1.0 - s
      } else {
        q = fa / fc
        r = fb / fc
        p = s * (2.0 * xm * q * (q - r) - (b - a) * (r - 1.0))
        q = (q - 1.0) * (r - 1.0) * (s - 1.0)
      }
      if (p > 0.0) {
        q = -q
      }
      p = Math.abs(p)
      const min1 = 3.0 * xm * q - Math.abs(eps * q)
      const min2 = Math.abs(e * q)
      if (2.0 * p < (min1 < min2 ? min1 : min2)) {
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
}
