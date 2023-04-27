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
 * Computes the modified Bessel function of the first kind with order one.
 *
 * @method _I1
 * @memberof ran.special
 * @param {number} x Value to evaluate the function at.
 * @return {number} The function value.
 * @private
 */
function _I1 (x) {
  const y = Math.abs(x)
  let z
  let t

  if (y < 3.75) {
    t = x / 3.75
    t *= t
    z = y * (0.5 + t * (0.87890594 + t * (0.51498869 + t * (0.15084934 + t * (0.2658733e-1 + t * (0.301532e-2 + t * 0.32411e-3))))))
  } else {
    t = 3.75 / y
    z = 0.2282967e-1 + t * (-0.2895312e-1 + t * (0.1787654e-1 - t * 0.420059e-2))
    z = 0.39894228 + t * (-0.3988024e-1 + t * (-0.362018e-2 + t * (0.163801e-2 + t * (-0.1031555e-1 + t * z))))
    z *= Math.exp(y) / Math.sqrt(y)
  }
  return x < 0 ? -z : z
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
  let bi
  let bim
  let bip
  let y

  if (n === 0) {
    return _I0(x)
  }

  if (n === 1) {
    return _I1(x)
  }

  if (x === 0) {
    return 0
  }

  const tox = 2 / Math.abs(x)
  bip = 0
  y = 0
  bi = 1
  for (let j = 2 * (n + Math.round(Math.sqrt(40 * n))); j > 0; j--) {
    bim = bip + j * tox * bi
    bip = bi
    bi = bim
    if (Math.abs(bi) > 1 / EPS) {
      y *= EPS
      bi *= EPS
      bip *= EPS
    }
    if (j === n) {
      y = bip
    }
  }
  y *= _I0(x) / bi
  return y
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
      // i0 separately
      return x === 0 ? 1 : Math.sinh(x) / x
    case 1:
      // i1 separately
      return x === 0 ? 0 : (Math.cosh(x) - Math.sinh(x) / x) / x
    default:
      if (n > 0) {
        // Use Wronskian with single run k-calculation
        const k = _kn(n + 1, x)
        return x === 0 ? 0 : 1 / (x * x * (_hi(n + 1, x) * k[1] + k[0]))
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
