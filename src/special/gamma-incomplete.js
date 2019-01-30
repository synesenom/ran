import { MAX_ITER, EPS, DELTA } from './_core'
import gammaLn from './gamma-log'

/**
 * Computes the regularized lower incomplete gamma function.
 *
 * @method _gli
 * @memberOf ran.special
 * @param {number} s Exponent of the integrand.
 * @param {number} x Upper boundary of the integration.
 * @return {number} The regularized lower incomplete gamma function.
 * @private
 */
function _gli (s, x) {
  if (x < 0) {
    return 0
  } else {
    let si = s

    let y = 1 / s

    let f = y
    for (let i = 0; i < MAX_ITER; i++) {
      si++
      y *= x / si
      f += y
      if (Math.abs(y) < Math.abs(f) * EPS) {
        break
      }
    }
    return f * Math.exp(-x + s * Math.log(x) - gammaLn(s))
  }
}

/**
 * Computes the regularized upper incomplete gamma function.
 *
 * @method _gui
 * @memberOf ran.special
 * @param {number} s Exponent of the integrand.
 * @param {number} x Lower boundary of the integration.
 * @return {number} The regularized upper incomplete gamma function.
 * @private
 */
function _gui (s, x) {
  let b = x + 1 - s

  let c = 1 / DELTA

  let d = 1 / b

  let f = d

  let fi
  let y
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
    if (Math.abs(y - 1) < EPS) {
      break
    }
  }
  return f * Math.exp(-x + s * Math.log(x) - gammaLn(s))
}

/**
 * Computes the regularized lower incomplete gamma function.
 *
 * @method gammaLowerIncomplete
 * @memberOf ran.special
 * @param {number} s Exponent of the integrand.
 * @param {number} x Upper boundary of the integration.
 * @return {number} The regularized lower incomplete gamma function.
 */
export function gammaLowerIncomplete (s, x) {
  return x < s + 1 ? _gli(s, x) : 1 - _gui(s, x)
}

/**
 * Computes the regularized upper incomplete gamma function.
 *
 * @method gammaUpperIncomplete
 * @memberOf ran.special
 * @param {number} s Exponent of the integrand.
 * @param {number} x Lower boundary of the integration.
 * @return {number} The regularized upper incomplete gamma function.
 */
export function gammaUpperIncomplete (s, x) {
  return x < s + 1 ? 1 - _gli(s, x) : _gui(s, x)
}
