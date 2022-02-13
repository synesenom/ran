import { EPS, MAX_ITER } from '../core/constants'
import neumaier from './neumaier'

const MAX_STEPS = 20
const POLYNOMIAL_ORDER = 5

function trapezoid (f, a, b, n) {
  if (n === 1) {
    return 0.5 * (b - a) * (f(a) + f(b))
  } else {
    let m = 2**(n - 2)
    let h = (b - a) / m
    let x = a + 0.5 * h
    let s = 0
    for (let i = 0; i < m; i++, x+=h) {
      s += f(x)
    }
    return 0.5 * (trapezoid(f, a, b, n - 1) + h * s)
  }
}

function interpolate (xa, ya, n, x) {
  let ns = 1
  let dif = Math.abs(x - xa[1])
  let c = new Array(n + 1).fill(0)
  let d = new Array(n + 1).fill(0)

  for (let i = 1; i <= n; i++) {
    let dift = Math.abs(x - xa[i])
    if (dift < dif) {
      ns = i
      dif = dift
    }
    c[i] = ya[i]
    d[i] = ya[i]
  }

  let dy = 0
  let y = ya[ns--]
  for (let m = 1; m < n; m++) {
    for (let i = 1; i <= n - m; i++) {
      const dxi = xa[i] - x
      const dxm = xa[i + m] - x
      const w = c[i + 1] - d[i]
      const den = w / (dxi - dxm)
      c[i] = dxi * den
      d[i] = dxm * den
    }
    dy = 2 * ns < n - m ? c[ns + 1] : d[ns--]
    y += dy
  }
  return {dy, y}
}

/**
 * Calculates the integral of a function using [Romberg's method]{@link http://en.wikipedia.org/wiki/Romberg%27s_method}.
 *
 * @method romberg
 * @memberof ran.algorithms
 * @param {Function} f Function to calculate definite integral for.
 * @param {number} a Lower boundary of the integration interval.
 * @param {number} b Upper boundary of the integration interval.
 * @return {number} The approximate integral of the function.
 * @private
 */
export default function (f, a, b){
  let s = new Array(MAX_STEPS + 1)
  let h = new Array(MAX_STEPS + 1).fill(1)

  for (let j = 0; j < MAX_STEPS; j++) {
    s[j] = trapezoid(f, a, b, j + 1)
    if (j >= POLYNOMIAL_ORDER - 1) {
      let {dy, y} = interpolate(h.slice(j - POLYNOMIAL_ORDER), s.slice(j - POLYNOMIAL_ORDER), POLYNOMIAL_ORDER, 0)
      if (Math.abs(dy) < EPS * Math.abs(y)) {
        return y
      }
    }
    h[j + 1] = 0.25 * h[j]
  }
  return 0
}
