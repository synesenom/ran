import { MAX_ITER, EPS, DELTA } from '../core/constants'
import logGamma from './log-gamma'
import { erfinv } from './error'

/**
 * Computes the regularized lower incomplete gamma function.
 *
 * @method _gli
 * @memberof ran.special
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
    return f * Math.exp(-x + s * Math.log(x) - logGamma(s))
  }
}

/**
 * Computes the regularized upper incomplete gamma function.
 *
 * @method _gui
 * @memberof ran.special
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
  return f * Math.exp(-x + s * Math.log(x) - logGamma(s))
}

/**
 * Computes the regularized lower incomplete gamma function.
 *
 * @method gammaLowerIncomplete
 * @memberof ran.special
 * @param {number} s Exponent of the integrand.
 * @param {number} x Upper boundary of the integration.
 * @return {number} The regularized lower incomplete gamma function.
 * @private
 */
export function gammaLowerIncomplete (s, x) {
  return x < s + 1 ? _gli(s, x) : 1 - _gui(s, x)
}

/**
 * Computes the regularized upper incomplete gamma function.
 *
 * @method gammaUpperIncomplete
 * @memberof ran.special
 * @param {number} s Exponent of the integrand.
 * @param {number} x Lower boundary of the integration.
 * @return {number} The regularized upper incomplete gamma function.
 * @private
 */
export function gammaUpperIncomplete (s, x) {
  return x < s + 1 ? 1 - _gli(s, x) : _gui(s, x)
}

/**
 * Computes the inverse of the regularized lower incomplete gamma function: returns x
 * such that gammaLowerIncomplete(a, x) = p. Uses Wilson-Hilferty initial estimate
 * refined by Halley iterations (third-order convergence, typically 2-3 steps).
 *
 * @method gammaLowerIncompleteInv
 * @memberof ran.special
 * @param {number} a Shape parameter (a > 0).
 * @param {number} p Target probability (0 <= p <= 1).
 * @returns {number} Value x such that gammaLowerIncomplete(a, x) = p.
 * @private
 */
export function gammaLowerIncompleteInv (a, p) {
  if (p <= 0) return 0
  if (p >= 1) return Infinity

  // Initial estimate: Wilson-Hilferty cube-root normal approximation for a >= 1;
  // leading-term series inversion for a < 1 (or when W-H produces a non-positive value).
  let x
  if (a >= 1) {
    const z = Math.SQRT2 * erfinv(2 * p - 1)
    const h = 9 * a
    x = a * Math.pow(1 - 1 / h + z / Math.sqrt(h), 3)
  }
  if (!(x > 0)) {
    // Fallback: invert the leading term P(a,x) ≈ x^a / Gamma(a+1) for small x
    x = Math.exp((Math.log(p) + logGamma(a + 1)) / a)
  }

  // Halley refinement: solve gammaLowerIncomplete(a, x) = p.
  // f  = P(a,x) - p
  // f' = x^{a-1} exp(-x) / Gamma(a)   (the gamma(a,1) PDF)
  // f''/f' = (a-1-x)/x                 (analytically)
  // step = (f/f') / (1 - (f/f') * (a-1-x) / (2x))
  const lga = logGamma(a)
  for (let i = 0; i < MAX_ITER; i++) {
    const f = gammaLowerIncomplete(a, x) - p
    const f1 = Math.exp((a - 1) * Math.log(x) - x - lga)
    if (f1 === 0) break
    const u = f / f1
    const dx = u / (1 - u * (a - 1 - x) / (2 * x))
    x -= dx
    x = Math.max(x, 1e-300)
    if (Math.abs(dx) <= EPS * x) break
  }
  return x
}
