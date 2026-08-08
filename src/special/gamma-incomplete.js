import { MAX_ITER, EPS, DELTA } from '../core/constants'
import logGamma from './log-gamma'
import { bd0, stirlerr } from './_deviance'

// See solutions/special-functions/2026-08-08-2059-gamma-incomplete-gui-cancellation-and-small-s-convergence.md

// EPS is a fixed constant, so this is the same value on every call; precomputed once
// rather than recomputing Math.log(1/EPS) inside _gli/_gui's hot maxIter formula.
const LOG_INV_EPS = Math.log(1 / EPS)

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
    // Near x ≈ s the series converges slowly: O(sqrt(s·log(1/ε))) terms needed.
    // The fixed MAX_ITER=100 is insufficient for s ≳ ~120 with x near s.
    const maxIter = Math.max(MAX_ITER, Math.ceil(Math.sqrt(2 * (s + 1) * LOG_INV_EPS)))
    for (let i = 0; i < maxIter; i++) {
      si++
      y *= x / si
      f += y
      if (Math.abs(y) < Math.abs(f) * EPS) {
        break
      }
    }
    // sqrt(s/(2*pi))*exp(-bd0(s,x)-stirlerr(s)) replaces exp(-x+s*log(x)-logGamma(s)):
    // the latter cancels three O(s)-magnitude terms down to an O(1) result once s and x
    // are both large, losing ~s*EPS of absolute precision in the exponent regardless of
    // how exactly each term is computed (#1348). The Loader (2000) decomposition keeps
    // every term O(1) or O(log s), so no such cancellation occurs at any magnitude.
    return f * Math.sqrt(s / (2 * Math.PI)) * Math.exp(-bd0(s, x) - stirlerr(s))
  }
}

// Signals _gui's non-convergence to the caller instead of letting it return silently,
// mirroring _fc's _assertFcConverged in marcum-q.js (ADR-0049, decisions/0049-continued-
// fraction-convergence-throw.md): a continued fraction has no bounded-error guarantee
// tying an unconverged iterate to the true value, so the exhausted-budget case must
// throw rather than silently hand back a truncated result.
function _assertGuiConverged (y, s, x, maxIter) {
  if (Math.abs(y - 1) > EPS) {
    throw Error(`_gui: continued fraction failed to converge for s=${s}, x=${x} after ${maxIter} iterations`)
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
 * @throws {Error} If the continued fraction fails to converge within its regime-aware budget.
 * @private
 */
function _gui (s, x) {
  let b = x + 1 - s

  let c = 1 / DELTA

  let d = 1 / b

  let f = d

  let fi
  let y
  // Near x ≈ s the continued fraction converges slowly; the fixed MAX_ITER=100 silently
  // truncated there (#1348), the same failure class #1286 fixed in _fc. Two regimes both
  // need more than 100 steps: large s (measured ~150-160 iterations at s~5000, x~5000,
  // covered by _gli's sqrt(s)-scaling formula), and s near zero (measured up to ~99
  // iterations at the x=s+1 boundary regardless of how small s is -- the sqrt(s) formula
  // alone would give ~9 there, far short -- so the floor is raised from MAX_ITER=100 to
  // 200, empirically confirmed >=2x the worst-case measured need across a sweep of s from
  // 1e-20 to 20000 and x/(s+1) from 1+1e-5 to 3).
  const maxIter = Math.max(200, Math.ceil(Math.sqrt(2 * (s + 1) * LOG_INV_EPS)))
  for (let i = 1; i < maxIter; i++) {
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
  _assertGuiConverged(y, s, x, maxIter)
  // See _gli's matching comment above for why this replaces exp(-x+s*log(x)-logGamma(s)).
  return f * Math.sqrt(s / (2 * Math.PI)) * Math.exp(-bd0(s, x) - stirlerr(s))
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
    // A&S §26.2.17 rational approximation: |error| < 4.5e-4, avoids nested erfinv iteration.
    const q = p <= 0.5 ? p : 1 - p
    const t = Math.sqrt(-2 * Math.log(q))
    const z0 = t - (2.515517 + t * (0.802853 + t * 0.010328)) /
                (1 + t * (1.432788 + t * (0.189269 + t * 0.001308)))
    const z = p <= 0.5 ? -z0 : z0
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
    const xPrev = x
    x = xPrev - dx
    // Relative floor: prevent x from going to zero/negative while still allowing
    // convergence to values far below 1e-300 (the old absolute floor blocked this).
    x = Math.max(x, xPrev * 1e-15)
    if (Math.abs(dx) <= EPS * x) break
  }
  return x
}
