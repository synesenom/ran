// Source: https://people.sc.fsu.edu/~jburkardt/py_src/owens/owens.html
import { erf, erfc } from './error'

let c2 = [
  0.99999999999999987510, -0.99999999999988796462, 0.99999999998290743652, -0.99999999896282500134, 0.99999996660459362918, -0.99999933986272476760, 0.99999125611136965852, -0.99991777624463387686, 0.99942835555870132569, -0.99697311720723000295, 0.98751448037275303682, -0.95915857980572882813, 0.89246305511006708555, -0.76893425990463999675, 0.58893528468484693250, -0.38380345160440256652, 0.20317601701045299653, -0.82813631607004984866e-01, 0.24167984735759576523e-01, -0.44676566663971825242e-02, 0.39141169402373836468e-03
]

const meth = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 4, 4, 4, 4, 5, 6]

const ord = [2, 3, 4, 5, 7, 10, 12, 18, 10, 20, 30, 20, 4, 7, 8, 20, 13, 0]

const pts = [0.35082039676451715489E-02, 0.31279042338030753740E-01, 0.85266826283219451090E-01, 0.16245071730812277011, 0.25851196049125434828, 0.36807553840697533536, 0.48501092905604697475, 0.60277514152618576821, 0.71477884217753226516, 0.81475510988760098605, 0.89711029755948965867, 0.95723808085944261843, 0.99178832974629703586]

const rrtpi = 1 / Math.sqrt(2 * Math.PI)
const rtwopi = 0.15915494309189533577



const arange = [0.025, 0.09, 0.15, 0.36, 0.5, 0.9, 0.99999]
const hrange = [0.02, 0.06, 0.09, 0.125, 0.26, 0.4, 0.6, 1.6, 1.7, 2.33, 2.4, 3.36, 3.4, 4.8]
const select = [
  [ 1, 1, 2,13,13,13,13,13,13,13,13,16,16,16, 9 ],
  [ 1, 2, 2, 3, 3, 5, 5,14,14,15,15,16,16,16, 9 ],
  [ 2, 2, 3, 3, 3, 5, 5,15,15,15,15,16,16,16,10 ],
  [ 2, 2, 3, 5, 5, 5, 5, 7, 7,16,16,16,16,16,10 ],
  [ 2, 3, 3, 5, 5, 6, 6, 8, 8,17,17,17,12,12,11 ],
  [ 2, 3, 5, 5, 5, 6, 6, 8, 8,17,17,17,12,12,12 ],
  [ 2, 3, 4, 4, 6, 6, 8, 8,17,17,17,17,17,12,12 ],
  [ 2, 3, 4, 4, 6, 6,18,18,18,18,17,17,17,12,12 ]
]
function _selectMethod(h, a) {
  let row = 8
  for (let i = 0; i < 7; i++) {
    if (a <= arange[i]) {
      row = i + 1
      break
    }
  }

  let col = 15
  for (let i = 0; i < 14; i++) {
    if (h <= hrange[i]) {
      col = i + 1
      break
    }
  }

  let code = select[row - 1][col - 1]
  let order = ord[code - 1]
  let method = meth[code - 1]

  return {method, order}
}

function _phi (z) {
  return 0.5 * erf(z / Math.SQRT2)
}

function _phic (z) {
  return 0.5 * erfc(z / Math.SQRT2)
}

// T1
function _t1(h, a, m) {
  let hs = -0.5 * h * h
  let dhs = Math.exp(hs)
  let ass = a * a
  let j = 1
  let jj = 1
  let aj = rtwopi * a
  let value = rtwopi * Math.atan(a)
  let dj = dhs - 1
  let gj = hs * dhs

  while (true) {
    value = value + dj * aj / jj

    if (m <= j) {
      return value
    }

    j++
    jj += 2
    aj *= ass
    dj = gj - dj
    gj *= hs / j
  }
}

// T2
function _t2 (h, a, ah, m) {
  let maxii = m + m + 1
  let ii = 1
  let value = 0
  let hs = h * h
  let ass = -a * a
  let vi = rrtpi * a * Math.exp(-0.5 * ah * ah)
  let z = _phi(ah) / h
  let y = 1 / hs

  while (true) {
    value += z

    if (maxii <= ii) {
      value *= rrtpi * Math.exp(-0.5 * hs)
      return value
    }

    z = y * (vi - ii * z)
    vi *= ass
    ii += 2
  }
}

function _t3(h, a, ah, m) {
  let i = 1
  let ii = 1
  let value = 0
  let hs = h * h
  let ass = a * a
  let vi = rrtpi * a * Math.exp(-0.5 * ah * ah)
  let zi = _phi(ah) / h
  let y = 1 / hs

  while (true) {
    value = value + zi * c2[i - 1]

    if (m < i) {
      value = value * rrtpi * Math.exp(-0.5 * hs)
      return value
    }

    zi = y * (ii * zi - vi)
    vi = ass * vi
    i++
    ii += 2
  }
}

function _t4 (h, a, m) {
  let maxii = m + m + 1
  let ii = 1
  let hs = h * h
  let ass = -a * a
  let value = 0
  let ai = rtwopi * a * Math.exp(-0.5 * hs * (1 - ass))
  let yi = 1

  while (true) {

    value = value + ai * yi

    if (maxii <= ii) {
      return value
    }

    ii = ii + 2
    yi = (1 - hs * yi) / ii
    ai = ai * ass
  }
}

const wts = [0.18831438115323502887E-01, 0.18567086243977649478E-01, 0.18042093461223385584E-01, 0.17263829606398753364E-01, 0.16243219975989856730E-01, 0.14994592034116704829E-01, 0.13535474469662088392E-01, 0.11886351605820165233E-01, 0.10070377242777431897E-01, 0.81130545742299586629E-02, 0.60419009528470238773E-02, 0.38862217010742057883E-02, 0.16793031084546090448E-02]
function _t5 (h, a, m) {
  let value = 0
  let ass = a * a
  let hs = -0.5 * h * h
  for (let i = 0; i < m; i++) {
    let r = 1 + ass * pts[i]
    value = value + wts[i] * Math.exp(hs * r) / r
  }
  return a * value
}

function _t6 (h, a) {
  let normh = _phic(h)
  let value = 0.5 * normh * (1 - normh)
  let y = 1 - a
  let r = Math.atan(y / (1 + a))

  if (r !== 0) {
    value -= rtwopi * r * Math.exp(-0.5 * y * h * h / r)
  }

  return value
}

function _t (h, a, ah) {
  let {method, order} = _selectMethod(h, a)

  switch (method) {
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

  let absh = Math.abs(h)
  let absa = Math.abs(a)
  let ah = absa * absh
  let value

  if (absa <= 1) {
    value = _t(absh, absa, ah)
  } else if (absh <= cut) {
    value = 0.25 - _phi(absh) * _phi(ah) - _t(ah, 1.0 / absa, absh)
  } else {
    let normh = _phic(absh)
    let normah = _phic(ah)
    value = 0.5 * (normh + normah) - normh * normah - _t(ah, 1.0 / absa, absh)
  }

  if (a < 0.0) {
    value = -value
  }

  return value
}
