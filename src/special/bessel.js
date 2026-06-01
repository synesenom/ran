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
export function besselInu (nu, x) {
  return Math.pow(x / 2, nu) * recursiveSum({
    c: 1 / gamma(nu + 1)
  }, (t, i) => {
    t.c *= x * x / (4 * i * (nu + i))
    return t
  }, t => t.c)
}
