import { EPS, MAX_ITER } from '../core/constants'
import gamma from './gamma'
import recursiveSum from '../algorithms/recursive-sum'

/**
 * Computes the modified Bessel function of the first kind with order zero.
 * This algorithm simply applies the definition:
 * https://en.wikipedia.org/wiki/Bessel_function#Modified_Bessel_functions:_I%CE%B1,_K%CE%B1
 *
 * @method _I0
 * @memberof ran.special
 * @param {number} x Value to evaluate the function at.
 * @return {number} The function value.
 * @private
 */
function _I0 (x) {
  let dz = 1
  let z = dz
  for (let m = 1; m < MAX_ITER; m++) {
    dz *= (x / 2) ** 2 / m ** 2
    z += dz
    if (Math.abs(dz / z) < EPS) { break }
  }
  return z
}

/**
 * Computes the modified spherical Bessel function of the second kind.
 *
 * @method _kn
 * @memberof ran.special
 * @param {number} n Order of the Bessel function.
 * @param {number} x Value to evaluate the function at.
 * @return {(number|number[])} The function value at the specified order and one order less if order is larger than 1, single function value otherwise.
 * @private
 */
function _kn (n, x) {
  // Upwards recurrence relation
  let k1 = 1 + 1 / x
  let k2 = 1
  let k
  for (let i = 2; i <= n; i++) {
    k = (i + i - 1) * k1 / x + k2
    k2 = k1
    k1 = k
  }
  return [
    Math.exp(-x) * k / x,
    Math.exp(-x) * k2 / x
  ]
}

/**
 * Computes the ratio of two modified Bessel functions (same for spherical).
 *
 * @method _hi
 * @memberof ran.special
 * @param {number} n Order of the Bessel function in the numerator.
 * @param {number} x Value to evaluate the function at.
 * @return {number} The function value.
 * @private
 */
function _hi (n, x) {
  // Continued fraction (from Numerical methods for special functions)
  let d = x / (n + n + 1)
  let del = d
  let h = del
  let b = (n + n + 3) / x
  for (let i = 1; i < MAX_ITER; i++) {
    d = 1 / (b + d)
    del = (b * d - 1) * del
    h += del
    b += 2 / x

    if (Math.abs(del / h) < EPS) { break }
  }
  return h
}

// Miller backward recurrence. Normalization via the all-order sum identity
// I_0(x) + 2*(I_1+I_2+...) = e^x (DLMF 10.35.3 at theta=0), computed in
// log-space to avoid exp(x) overflow for x > ~710. Overflow guard rescales
// all four accumulators uniformly, preserving the ratio f_n/S.
// See solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md
function _besselIBackward (n, x) {
  const tox = 2 / x
  const overflow = 1 / EPS
  let bi = 1
  let bip = 0
  let y = 0
  let sum = 0
  // j_max must exceed both n and x: when j < x the ratio I_{j+1}/I_j ≈ 1
  // and the backward recurrence hasn't contracted enough to suppress the K_n component.
  for (let j = 2 * (n + Math.round(Math.sqrt(40 * n))) + Math.ceil(2 * x); j > 0; j--) {
    const bim = bip + j * tox * bi
    bip = bi
    bi = bim
    sum += 2 * bip
    if (j === n) y = bip
    if (Math.abs(bi) > overflow) {
      y *= EPS
      bi *= EPS
      bip *= EPS
      sum *= EPS
    }
  }
  sum += bi
  if (n === 0) y = bi
  return y * Math.exp(x - Math.log(sum))
}

/**
 * Computes the modified Bessel function of the first kind. Only integer order.
 *
 * @method besselI
 * @memberof ran.special
 * @param {number} n Order of the Bessel function. Must be an integer.
 * @param {number} x Value to evaluate the function at.
 * @return {number} The modified Bessel function of the first kind.
 * @private
 */
export function besselI (n, x) {
  if (n === 0) {
    // _I0 Taylor series is accurate for |x| <= 10; use backward recurrence for large |x|
    // to avoid MAX_ITER truncation before the series peak at m ~ |x|/2.
    const ax = Math.abs(x)
    return ax <= 10 ? _I0(x) : _besselIBackward(0, ax)
  }
  if (x === 0) {
    return 0
  }
  const y = _besselIBackward(n, Math.abs(x))
  // Odd-order modified Bessel functions are odd: I_n(-x) = -I_n(x) for odd n.
  return x < 0 && n % 2 === 1 ? -y : y
}

// Relative error of the n=1 closed-form (cosh(x)-sinh(x)/x)/x from catastrophic
// cancellation grows as 2ε/(x²/3). Using Taylor series for |x| < 1 keeps the
// relative error below 2ε everywhere in that range; the series converges with
// ratio x²/(2(k+1)(2n+2k+3)) per step, which is at most 1/10 per step at x=1.
// decisions/0013-besselISpherical-small-x-taylor.md
const _BESSEL_I_SPH_THRESHOLD = 1

// Taylor series Σ_{k=0}^∞ x^{n+2k} / (2^k k! (2n+2k+1)!!) for i_n(x), n >= 1.
// Naturally returns 0 at x = 0 without a special-case guard.
function _besselISphericalTaylor (n, x) {
  let t = 1
  for (let j = 1; j <= n; j++) {
    t *= x / (2 * j + 1)
  }
  let sum = t
  const x2 = x * x
  for (let k = 0; k < MAX_ITER && Math.abs(t) > EPS * Math.abs(sum); k++) {
    t *= x2 / (2 * (k + 1) * (2 * n + 2 * k + 3))
    sum += t
  }
  return sum
}

/**
 * Computes the modified spherical Bessel function of the first kind. Only integer order is supported.
 * Source: http://cpc.cs.qub.ac.uk/summaries/ADGM_v1_0.html (Numerical methods for special functions).
 *
 * @method besselISpherical
 * @memberof ran.special
 * @param {number} n Order of the spherical Bessel function. Must be an integer.
 * @param {number} x Value to evaluate the function at.
 * @returns {number} The modified spherical Bessel function of the first kind.
 * @private
 */
export function besselISpherical (n, x) {
  switch (n) {
    case 0:
      return x === 0 ? 1 : Math.sinh(x) / x
    case 1:
      return Math.abs(x) < _BESSEL_I_SPH_THRESHOLD
        ? _besselISphericalTaylor(1, x)
        : (Math.cosh(x) - Math.sinh(x) / x) / x
    default:
      if (n > 0) {
        if (Math.abs(x) < _BESSEL_I_SPH_THRESHOLD) {
          return _besselISphericalTaylor(n, x)
        }
        // Use Wronskian with single run k-calculation
        const k = _kn(n + 1, x)
        return 1 / (x * x * (_hi(n + 1, x) * k[1] + k[0]))
      } else {
        // Backward recurrence for negative orders
        return (n + n + 3) * besselISpherical(n + 1, x) / x + besselISpherical(n + 2, x)
      }
  }
}

// Crossover from series to asymptotic expansion for K_0 and K_1.
// Below X_K_SERIES the combined-series form (DLMF §10.31.2) retains ≥10 significant
// figures; above it, the series accumulates O(e^{2x}) intermediate values that nearly
// cancel against the tiny e^{-x} result, losing all precision.
// See solutions/special-functions/2026-07-05-1530-bessel-k-second-kind-cancellation-strategy.md
const _X_K_SERIES = 6

/**
 * Asymptotic expansion of K_ν(x) for large x (DLMF §10.40.2):
 *   K_ν(x) ~ sqrt(π/(2x)) * exp(-x) * Σ_{k=0}^M a_k(ν) / x^k
 * where a_0 = 1 and a_{k+1} = a_k * (4ν² − (2k+1)²) / (8(k+1)x).
 * Optimal truncation (stop when |a_{k+1}/x| ≥ |a_k/x^k|) bounds the error by the
 * first omitted term, avoiding divergence of the asymptotic series.
 *
 * @method _KAsymptotic
 * @memberof ran.special
 * @param {number} nu Order (real).
 * @param {number} x Positive value to evaluate at.
 * @returns {number} K_nu(x).
 * @private
 */
function _KAsymptotic (nu, x) {
  const nu2 = 4 * nu * nu
  let term = 1
  let sum = 1
  for (let k = 1; k < MAX_ITER; k++) {
    const next = term * (nu2 - (2 * k - 1) * (2 * k - 1)) / (8 * k * x)
    // Optimal truncation: stop when the asymptotic series starts to diverge
    if (Math.abs(next) >= Math.abs(term)) { break }
    term = next
    sum += term
    if (Math.abs(term) < EPS * Math.abs(sum)) { break }
  }
  return Math.sqrt(Math.PI / (2 * x)) * Math.exp(-x) * sum
}

/**
 * Computes the modified Bessel function of the second kind with order zero.
 * For x ≤ _X_K_SERIES: combined series K_0(x) = Σ_{k=0}^∞ (x²/4)^k / (k!)² · (H_k − lnh)
 * where H_k are harmonic numbers and lnh = ln(x/2) + γ (DLMF §10.31.2).
 * The combined form avoids catastrophic cancellation by grouping the two large terms.
 * For x > _X_K_SERIES: asymptotic expansion (DLMF §10.40.2).
 *
 * @method _K0
 * @memberof ran.special
 * @param {number} x Positive value to evaluate at.
 * @returns {number} K_0(x).
 * @private
 */
function _K0 (x) {
  if (x > _X_K_SERIES) { return _KAsymptotic(0, x) }
  const x2 = x * x / 4
  // ln(x/2) + γ, where γ = 0.5772156649015329 (Euler–Mascheroni constant)
  const lnh = Math.log(x / 2) + 0.5772156649015329
  return recursiveSum(
    { t: 1, h: 0 },
    (s, i) => {
      s.h += 1 / i
      s.t *= x2 / (i * i)
      return s
    },
    s => s.t * (s.h - lnh)
  )
}

/**
 * Computes the modified Bessel function of the second kind with order one.
 * For x ≤ _X_K_SERIES: combined series K_1(x) = 1/x + (x/2)·Σ_{k=0}^∞ (x²/4)^k / (k!(k+1)!)
 * · [(ln(x/2)+γ) − (H_k+H_{k+1})/2] where H_k are harmonic numbers (DLMF §10.31.2).
 * For x > _X_K_SERIES: asymptotic expansion (DLMF §10.40.2).
 *
 * @method _K1
 * @memberof ran.special
 * @param {number} x Positive value to evaluate at.
 * @returns {number} K_1(x).
 * @private
 */
function _K1 (x) {
  if (x > _X_K_SERIES) { return _KAsymptotic(1, x) }
  const x2 = x * x / 4
  const lnh = Math.log(x / 2) + 0.5772156649015329
  const sum = recursiveSum(
    { t: 1, hk: 0, hk1: 1 },
    (s, i) => {
      s.hk = s.hk1
      s.hk1 += 1 / (i + 1)
      s.t *= x2 / (i * (i + 1))
      return s
    },
    s => s.t * (lnh - (s.hk + s.hk1) / 2)
  )
  return 1 / x + (x / 2) * sum
}

/**
 * Computes the modified Bessel function of the second kind. Only integer order.
 *
 * @method besselK
 * @memberof ran.special
 * @param {number} n Order of the Bessel function. Must be a non-negative integer.
 * @param {number} x Value to evaluate the function at.
 * @returns {number} The modified Bessel function of the second kind.
 * @private
 */
export function besselK (n, x) {
  if (x === 0) return Infinity
  if (n === 0) return _K0(x)
  if (n === 1) return _K1(x)
  // Upward recurrence K_{n+1}(x) = (2n/x)*K_n(x) + K_{n-1}(x) is forward-stable
  // for K because K grows with n (dominant component is preserved). DLMF §10.29.1.
  let k0 = _K0(x)
  let k1 = _K1(x)
  for (let i = 1; i < n; i++) {
    const k = (2 * i / x) * k1 + k0
    k0 = k1
    k1 = k
  }
  return k1
}

/**
 * Computes the modified Bessel function of the second kind for real order.
 * Uses the connection formula K_ν(x) = (π/2)·(I_{-ν}(x) − I_ν(x))/sin(νπ) (DLMF 10.27.4).
 * Dispatches to `besselK` for near-integer ν to avoid the 0/0 indeterminate form.
 *
 * @method besselKnu
 * @memberof ran.special
 * @param {number} nu Order of the Bessel function. Should be fractional.
 * @param {number} x Value to evaluate the function at.
 * @returns {number} The modified Bessel function of the second kind.
 * @private
 */
export function besselKnu (nu, x) {
  if (x === 0) return Infinity
  // Near-integer ν: connection formula becomes 0/0; dispatch to integer path.
  // Use Math.abs so negative integers forward the correct non-negative order to besselK.
  if (Math.abs(nu - Math.round(nu)) < 1e-8) {
    return besselK(Math.abs(Math.round(nu)), x)
  }
  // Large x: connection formula loses ~2x/ln(10) digits from catastrophic cancellation
  // between I_{-ν}(x) and I_ν(x) (both O(exp(x)) while K_ν is O(exp(-x))).
  // Asymptotic expansion avoids this and terminates exactly for half-integer ν.
  if (x > _X_K_SERIES) {
    return _KAsymptotic(nu, x)
  }
  return (Math.PI / 2) * (besselInu(-nu, x) - besselInu(nu, x)) / Math.sin(Math.PI * nu)
}

/**
 * Computes the modified Bessel function of the first kind for fractional order.
 *
 * @method besselInu
 * @memberof ran.special
 * @param {number} nu Order of the Bessel function. Should be fractional.
 * @param {number} x Value to evaluate the function at.
 * @returns {number} The modified Bessel function of the first kind.
 * @private
 */
// Taylor series converges for x ≤ ~710 with MAX_SERIES_ITER=500; see
// solutions/testing/2026-06-02-1200-besselInu-infrastructure-fix-coverage-gap.md
export function besselInu (nu, x) {
  return Math.pow(x / 2, nu) * recursiveSum({
    c: 1 / gamma(nu + 1)
  }, (t, i) => {
    t.c *= x * x / (4 * i * (nu + i))
    return t
  }, t => t.c)
}
