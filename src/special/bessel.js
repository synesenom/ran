import { EPS, MAX_ITER } from './_core'

/**
 * Computes the modified Bessel function of the first kind with order zero.
 *
 * @method _I0
 * @memberOf ran.special
 * @param {number} x Value to evaluate the function at.
 * @return {number} The function value.
 * @private
 */
function _I0 (x) {
  let y = Math.abs(x)
  let z
  let t

  if (y < 3.75) {
    t = x / 3.75
    t *= t
    z = 1 + t * (3.5156229 + t * (3.0899424 + t * (1.2067492 + t * (0.2659732 + t * (0.360768e-1 + t * 0.45813e-2)))))
  } else {
    t = 3.75 / y
    z = (Math.exp(y) / Math.sqrt(y)) * (0.39894228 + t * (0.1328592e-1 + t * (0.225319e-2 + t * (-0.157565e-2 + t * (0.916281e-2 + t * (-0.2057706e-1 + t * (0.2635537e-1 + t * (-0.1647633e-1 + t * 0.392377e-2))))))))
  }
  return z
}

/**
 * Computes the modified Bessel function of the first kind with order one.
 *
 * @method _I1
 * @memberOf ran.special
 * @param {number} x Value to evaluate the function at.
 * @return {number} The function value.
 * @private
 */
function _I1 (x) {
  let y = Math.abs(x)
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
 * Computes the modified Bessel function of the first kind. Only supports integer order.
 *
 * @method besselI
 * @memberOf ran.special
 * @param {number} n Order of the Bessel function. Must be an integer.
 * @param {number} x Value to evaluate the function at.
 * @return {number} The modified Bessel function of the first kind.
 * @private
 */
export function besselI (n, x) {
  let bi
  let bim
  let bip
  let tox
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

  tox = 2 / Math.abs(x)
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
  return x < 0 ? -y : y
}

/**
 * Computes the modified spherical Bessel function of the second kind.
 *
 * @method _kn
 * @memberOf ran.special
 * @param {number} n Order of the Bessel function.
 * @param {number} x Value to evaluate the function at.
 * @return {(number|number[])} The function value at the specified order and one order less if order is larger than 1, single function value otherwise.
 * @private
 */
function _kn (n, x) {
  switch (n) {
    case 0:
      return Math.exp(-x) / x
    case 1:
      return Math.exp(-x) * (1 + 1 / x) / x
    default:
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
}

/**
 * Computes the ratio of two modified Bessel functions (same for spherical).
 * H(n, x) = I(n
 *
 * @method _hi
 * @memberOf ran.special
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
 * Computes the modified spherical Bessel function of the first kind. Only supports integer order.
 * Source: http://cpc.cs.qub.ac.uk/summaries/ADGM_v1_0.html (Numerical methods for special functions).
 *
 * @method besselISpherical
 * @memberOf ran.special
 * @param {number} n Order of the spherical Bessel function. Must be an integer.
 * @param {number} x Value to evaluate the function at.
 * @return {number} The modified spherical Bessel function of the first kind.
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
        let k = _kn(n + 1, x)
        return x === 0 ? 0 : 1 / (x * x * (_hi(n + 1, x) * k[1] + k[0]))
      } else {
        // Backward recurrence for negative orders
        return (n + n + 3) * besselISpherical(n + 1, x) / x + besselISpherical(n + 2, x)
      }
  }
}
