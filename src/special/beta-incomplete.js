import { MAX_ITER, EPS, DELTA } from './_core'
import gammaLn from './gamma-log'

// Incomplete beta generator using the continued fraction expansion
function _biContinuedFraction (a, b, x) {
  let qab = a + b

  let qap = a + 1

  let qam = a - 1

  let c = 1

  let d = 1 - qab * x / qap
  d = Math.max(Math.abs(d), DELTA)
  d = 1 / d
  let h = d

  for (let i = 1; i < MAX_ITER; i++) {
    let m2 = 2 * i

    let aa = i * (b - i) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    d = Math.max(Math.abs(d), DELTA)
    c = 1 + aa / c
    c = Math.max(Math.abs(c), DELTA)
    d = 1 / d
    h *= d * c
    aa = -(a + i) * (qab + i) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    d = Math.max(Math.abs(d), DELTA)
    c = 1 + aa / c
    c = Math.max(Math.abs(c), DELTA)
    d = 1 / d
    let del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) { break }
  }
  return h
}

/**
   * Regularized incomplete beta function, using the continued fraction approximations.
   *
   * @method betaIncomplete
   * @memberOf ran.special
   * @param {number} a First parameter of the function.
   * @param {number} b Second parameter of the function.
   * @param {number} x Upper boundary of the integral.
   * @returns {number} Value of the incomplete beta function.
   * @private
   */
export default function (a, b, x) {
  let bt = (x <= 0 || x >= 1)
    ? 0
    : Math.exp(gammaLn(a + b) - gammaLn(a) - gammaLn(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2)
    ? bt * _biContinuedFraction(a, b, x) / a
    : 1 - bt * _biContinuedFraction(b, a, 1 - x) / b
}
