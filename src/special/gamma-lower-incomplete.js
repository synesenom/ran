import { MAX_ITER, EPS, DELTA } from './core'
import gamma from './gamma'

// Lower incomplete gamma generator using the series expansion
function _gliSeries (s, x) {
  if (x < 0) {
    return 0
  } else {
    let si = s

    let y = 1 / s

    let f = 1 / s
    for (let i = 0; i < MAX_ITER; i++) {
      si++
      y *= x / si
      f += y
      if (y < f * EPS) { break }
    }
    return Math.exp(-x) * Math.pow(x, s) * f
  }
}

// Upper incomplete gamma generator using the continued fraction expansion
function _guiContinuedFraction (s, x) {
  let b = x + 1 - s

  let c = 1 / DELTA

  let d = 1 / b

  let f = d

  let fi; let y
  for (let i = 1; i < MAX_ITER; i++) {
    fi = i * (s - i)
    b += 2
    d = fi * d + b
    d = Math.max(Math.abs(d), DELTA)
    d = 1 / d
    c = b + fi / c
    c = Math.max(Math.abs(c), DELTA)
    y = c * d
    f *= y
    if (Math.abs(y - 1) < EPS) { break }
  }
  return Math.exp(-x) * Math.pow(x, s) * f
}

/**
   * Lower incomplete gamma function, using the series expansion and continued fraction approximations.
   *
   * @method gammaLowerIncomplete
   * @memberOf ran.special
   * @param {number} s Parameter of the integrand in the integral definition.
   * @param {number} x Lower boundary of the integral.
   * @returns {number} Value of the lower incomplete gamma function.
   * @private
   */
export default function (s, x) {
  return x < s + 1 ? _gliSeries(s, x) : gamma(s) - _guiContinuedFraction(s, x)
}
