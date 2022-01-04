import { EPS, MAX_ITER } from '../special/_core'


/**
 * Finds the root of a function using Brent's method.
 * Source: https://en.wikipedia.org/wiki/Brent%27s_method
 *
 * @method brent
 * @memberof ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {number} a0 Lower boundary of the bracket.
 * @param {number} b0 Upper boundary of the bracket.
 * @return {(number|undefined)} The root location if found, undefined otherwise.
 * @private
 */
// TODO Use pseudo code from wikipedia.
export default function (f, a0, b0) {
  /*
  let a = a0
  let b = b0
  let c = 0
  let d = Number.MAX_VALUE
  let s = 0
  let fa = f(a)
  let fb = f(b)
  let fc = 0
  let fs = 0
  let tmp

  if ((fa > 0 && fb > 0) || (fa < 0 && fb < 0)) {
    // Root is not bracketed.
    return undefined
  }

  c = a
  fc = fa
  let mflag = true
  let k = 0
  for (; k < MAX_ITER && fb !== 0 && Math.abs(b - a) > EPS; k++) {
    if (Math.abs(fa) < Math.abs(fb)) {
      tmp = a
      a = b
      b = tmp
      tmp = fa
      fa = fb
      fb = tmp
    }

    if (fa !== fc && fb !== fc) {
      // Inverse quadratic interpolation.
      const fab = fa - fb
      const fac = fa - fc
      const fbc = fb - fc
      //s = a * fb * fc / fab / fac - b * fa * fc / fab / fbc + c * fa * fb / fac / fbc
      s = (a * fb * fc * fbc + c * fa * fb * fab - b * fa * fc * fac) / (fab * fac * fbc)
    } else {
      // Secant method.
      s = b - fb * (b - a) / (fb - fa)
    }

    let tmp2 = (3 * a + b) / 4
    if (!((s > tmp2 && s < b) || (s < tmp2 && s > b))
      // TODO pre-calculate repeating Math.abs.
      || (mflag && Math.abs(s - b) >= Math.abs(b - c) / 2)
      || (!mflag && Math.abs(s - b) >= Math.abs(c - d) / 2)
      || (mflag && Math.abs(b - c) < EPS)
      || (!mflag && Math.abs(c - d) < EPS)) {
      // Bisection method.
      s = (a + b) / 2
      mflag = true
    } else {
      mflag = false
    }

    fs = f(s)
    d = c
    c = b
    fc = fb

    if ((fa > 0 && fs < 0) || (fa < 0 && fs > 0)) {
      b = s
      fb = fs
    } else {
      a = s
      fa = fs
    }
  }

  return b
  */

  let a = a0
  let b = b0
  let c = b0
  let d, e
  let fa = f(a)
  let fb = f(b)
  let fc, p, q, r, s, eps, xm

  if ((fa > 0 && fb > 0) || (fa < 0 && fb < 0)) {
    return
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
}
