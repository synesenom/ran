import { MAX_ITER, EPS, DELTA } from '../core/constants'
import newton from '../algorithms/newton'

const C_ERF_INV = [
  0.0833333333333333,
  0.0145833333333333,
  0.0031498015873016,
  0.00075248704806,
  0.0001907475361251
]

// Maclaurin series for erf on [0, 2]; term recurrence avoids factorial overflow
function _erfSeries (x) {
  const x2 = x * x
  let term = x
  let sum = x
  for (let n = 1; n <= MAX_ITER; n++) {
    term *= -x2 * (2 * n - 1) / (n * (2 * n + 1))
    sum += term
    if (Math.abs(term) < Math.abs(sum) * EPS) break
  }
  return sum * 2 / Math.sqrt(Math.PI)
}

// Laplace continued fraction for erfc: b_n = x, a_n = n/2 (DLMF 7.9.2)
function _erfcCF (x) {
  let f = x
  let C = x
  let D = 0
  for (let n = 1; n <= MAX_ITER; n++) {
    const a = n / 2
    D = x + a * D
    if (Math.abs(D) < DELTA) D = DELTA
    D = 1 / D
    C = x + a / C
    if (Math.abs(C) < DELTA) C = DELTA
    const delta = C * D
    f *= delta
    if (Math.abs(delta - 1) < EPS) break
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f
}

/**
 * Computes the error function.
 *
 * @method erf
 * @memberof ran.special
 * @param {number} x Value to evaluate the error function at.
 * @returns {number} Error function value.
 * @private
 */
export function erf (x) {
  if (x < 0) return -erf(-x)
  if (x <= 2) return _erfSeries(x)
  return 1 - _erfcCF(x)
}

/**
 * Computes the complementary error function.
 *
 * @method erfc
 * @memberof ran.special
 * @param {number} x Value to evaluate the complementary error function at.
 * @returns {number} Complementary error function value.
 * @private
 */
export function erfc (x) {
  if (x > 26.6) return 0
  if (x < 0) return 1 + erf(-x)
  // Use CF directly for x > 1 to avoid cancellation in 1 - erf(x) near 1
  // See solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md
  if (x <= 1) return 1 - _erfSeries(x)
  return _erfcCF(x)
}

/**
 * Computes the inverse error function.
 *
 * @method erfinv
 * @memberof ran.special
 * @param {number} x Value to evaluate the inverse error function at.
 * @return {number} The inverse error function value.
 * @private
 */
export function erfinv (x) {
  // Estimate initial guess using the polynomial
  let x0 = 0
  const x2 = x * x
  let c = 0.5 * Math.pow(Math.PI, 5.5)
  for (let i = C_ERF_INV.length - 1; i >= 0; i--) {
    x0 = (x0 + C_ERF_INV[i] * c) * x2
    c /= Math.PI
  }
  x0 = (x0 + 1) * x

  // Polish with Newton's method
  return newton(
    t => erf(t) - x,
    t => 2 * Math.exp(-t * t) / Math.sqrt(Math.PI),
    x0
  )
}
