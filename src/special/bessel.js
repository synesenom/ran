import { EPS } from './_core'

function _i0 (x) {
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

function _i1 (x) {
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

const ACC = 40

/**
 * Modified Bessel function of the first kind.
 *
 * @method besselI
 * @memberOf ran.special
 * @param {number} n Order of the Bessel function.
 * @param {number} x Value to evaluate the function at.
 * @return {number} The modified Bessel function of the first kind.
 */
export function besselI (n, x) {
  let bi
  let bim
  let bip
  let tox
  let y

  if (n === 0) {
    return _i0(x)
  }

  if (n === 1) {
    return _i1(x)
  }

  if (x === 0) {
    return 0
  }

  tox = 2 / Math.abs(x)
  bip = 0
  y = 0
  bi = 1
  for (let j = 2 * (n + Math.round(Math.sqrt(ACC * n))); j > 0; j--) {
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
  y *= _i0(x) / bi
  return x < 0 ? -y : y
}
