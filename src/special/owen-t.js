import { erf, erfc } from './error'

// Constants
const PI2_SQRT_INV = 1 / Math.sqrt(2 * Math.PI)
const HALF_PI_INV = 0.5 / Math.PI

// Ranges for a and h to select algorithm
const aRanges = [
  0.025,
  0.09,
  0.15,
  0.36,
  0.5,
  0.9,
  0.99999
]
const hRanges = [
  0.02,
  0.06,
  0.09,
  0.125,
  0.26,
  0.4,
  0.6,
  1.6,
  1.7,
  2.33,
  2.4,
  3.36,
  3.4,
  4.8
]

// Algorithm sector codes
const codes = [
  [0, 0, 1,12,12,12,12,12,12,12,12,15,15,15, 8],
  [0, 1, 1, 2, 2, 4, 4,13,13,14,14,15,15,15, 8],
  [1, 1, 2, 2, 2, 4, 4,14,14,14,14,15,15,15, 9],
  [1, 1, 2, 4, 4, 4, 4, 6, 6,15,15,15,15,15, 9],
  [1, 2, 2, 4, 4, 5, 5, 7, 7,16,16,16,11,11,10],
  [1, 2, 4, 4, 4, 5, 5, 7, 7,16,16,16,11,11,11],
  [1, 2, 3, 3, 5, 5, 7, 7,16,16,16,16,16,11,11],
  [1, 2, 3, 3, 5, 5,17,17,17,17,16,16,16,11,11]
]

// Method to use
const methods = [
  1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 4, 4, 4, 4, 5, 6
]

// Order of approximation
const orders = [
  2, 3, 4, 5, 7, 10, 12, 18, 10, 20, 30, 20, 4, 7, 8, 20, 13, 0
]

// Some constants for the algorithms
let c2 = [
  0.99999999999999987510,
  -0.99999999999988796462,
  0.99999999998290743652,
  -0.99999999896282500134,
  0.99999996660459362918,
  -0.99999933986272476760,
  0.99999125611136965852,
  -0.99991777624463387686,
  0.99942835555870132569,
  -0.99697311720723000295,
  0.98751448037275303682,
  -0.95915857980572882813,
  0.89246305511006708555,
  -0.76893425990463999675,
  0.58893528468484693250,
  -0.38380345160440256652,
  0.20317601701045299653,
  -0.82813631607004984866e-01,
  0.24167984735759576523e-01,
  -0.44676566663971825242e-02,
  0.39141169402373836468e-03
]
const pts = [
  0.35082039676451715489E-02,
  0.31279042338030753740E-01,
  0.85266826283219451090E-01,
  0.16245071730812277011,
  0.25851196049125434828,
  0.36807553840697533536,
  0.48501092905604697475,
  0.60277514152618576821,
  0.71477884217753226516,
  0.81475510988760098605,
  0.89711029755948965867,
  0.95723808085944261843,
  0.99178832974629703586
]

const wts = [
  0.18831438115323502887E-01,
  0.18567086243977649478E-01,
  0.18042093461223385584E-01,
  0.17263829606398753364E-01,
  0.16243219975989856730E-01,
  0.14994592034116704829E-01,
  0.13535474469662088392E-01,
  0.11886351605820165233E-01,
  0.10070377242777431897E-01,
  0.81130545742299586629E-02,
  0.60419009528470238773E-02,
  0.38862217010742057883E-02,
  0.16793031084546090448E-02
]

// Some helper functions
function _phi (z) {
  return 0.5 * erf(z / Math.SQRT2)
}

function _phiComp (z) {
  return 0.5 * erfc(z / Math.SQRT2)
}

// T1
function _t1(h, a, m) {
  let hh = -0.5 * h * h
  let dhs = Math.exp(hh)
  let aa = a * a
  let aj = HALF_PI_INV * a
  let dj = dhs - 1
  let gj = hh * dhs
  let z = HALF_PI_INV * Math.atan(a)

  for (let i = 2, j = 1; i <= m; i++, j += 2) {
    z += dj * aj / j
    aj *= aa
    dj = gj - dj
    gj *= hh / i
  }
  return z
}

// T2
function _t2 (h, a, ah, m) {
  let hh = h * h
  let aa = -a * a
  let vi = PI2_SQRT_INV * a * Math.exp(-0.5 * ah * ah)
  let ph = _phi(ah) / h
  let y = 1 / hh
  let z = 0

  let iMax = m + m + 1
  for (let i = 1; i < iMax; i += 2) {
    z += ph
    ph = y * (vi - i * ph)
    vi *= aa
  }
  return PI2_SQRT_INV * Math.exp(-0.5 * hh) * z
}

// T3
function _t3(h, a, ah, m) {
  let hh = h * h
  let aa = a * a
  let vi = PI2_SQRT_INV * a * Math.exp(-0.5 * ah * ah)
  let ph = _phi(ah) / h
  let y = 1 / hh
  let z = 0

  for (let i = 1, ii = 1; i <= m; i++, ii += 2) {
    z += ph * c2[i - 1]
    ph = y * (ii * ph - vi)
    vi *= aa
  }
  return PI2_SQRT_INV * Math.exp(-0.5 * hh) * z
}

// T4
function _t4 (h, a, m) {
  let hh = h * h
  let aa = -a * a
  let z = 0
  let ai = HALF_PI_INV * a * Math.exp(-0.5 * hh * (1 - aa))
  let yi = 1

  let iMax = m + m + 1
  for (let i = 3; i <= iMax; i += 2) {
    z += ai * yi
    yi = (1 - hh * yi) / i
    ai *= aa
  }
  return z
}

// T5
function _t5 (h, a, m) {
  let hh = -0.5 * h * h
  let aa = a * a
  let z = 0

  for (let i = 0; i < m; i++) {
    let r = 1 + aa * pts[i]
    z += wts[i] * Math.exp(hh * r) / r
  }
  return a * z
}

// T6
function _t6 (h, a) {
  let phi = _phiComp(h)
  let y = 1 - a
  let r = Math.atan(y / (1 + a))
  let z = 0.5 * phi * (1 - phi)

  if (r !== 0) {
    z -= HALF_PI_INV * r * Math.exp(-0.5 * y * h * h / r)
  }
  return z
}

function _t (h, a, ah) {
  // Find sector row
  let row = 7
  for (let i = 0; i < 7; i++) {
    if (a <= aRanges[i]) {
      row = i
      break
    }
  }

  // Find sector column
  let col = 14
  for (let i = 0; i < 14; i++) {
    if (h <= hRanges[i]) {
      col = i
      break
    }
  }

  // Find sector code and order
  let code = codes[row][col]
  let order = orders[code]

  // Run corresponding algorithm
  switch (methods[code]) {
    case 1:
    default:
      return _t1(h, a, order)
    case 2:
      return _t2(h, a, ah, order)
    case 3:
      return _t3(h, a, ah, order)
    case 4:
      return _t4(h, a, order)
    case 5:
      return _t5(h, a, order)
    case 6:
      return _t6(h, a)
  }
}

/**
 * Computes the Owen's T function based on the paper https://www.jstatsoft.org/article/view/v005i05/t.pdf.
 * Translated from the python code: https://people.sc.fsu.edu/~jburkardt/py_src/owens/owens.html
 *
 * @method owenT
 * @memberOf ran.special
 * @param {number} h First parameter.
 * @param {number} a Second parameter.
 * @returns {number} Owen's T function at the specified values.
 * @private
 */
export default function (h, a) {
  let cut = 0.67
  let hAbs = Math.abs(h)
  let aAbs = Math.abs(a)
  let ah = aAbs * hAbs
  let z

  if (aAbs <= 1) {
    z = _t(hAbs, aAbs, ah)
  } else if (hAbs <= cut) {
    z = 0.25 - _phi(hAbs) * _phi(ah) - _t(ah, 1 / aAbs, hAbs)
  } else {
    let phiH = _phiComp(hAbs)
    let phiAh = _phiComp(ah)
    z = 0.5 * (phiH + phiAh) - phiH * phiAh - _t(ah, 1 / aAbs, hAbs)
  }

  return a < 0 ? -z : z
}
