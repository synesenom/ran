import { EPS } from '../special/_core'
import logGamma from '../special/log-gamma'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import { gamma, poisson } from './_core'
import Distribution from './_distribution'

export default class extends Distribution {
  constructor (d1 = 2, d2 = 2, lambda = 1) {
    super()

    // Validate parameters
    let mi = Math.round(d1)
    let ni = Math.round(d2)
    this.p = { m: mi, n: ni, lambda }
    this._validate({ m: mi, n: ni, lambda }, [
      'm > 0',
      'n > 0',
      'lambda >= 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    let x1 = gamma(this.r, this.p.m / 2 + poisson(this.r, this.p.lambda / 2), 0.5)
    let x2 = gamma(this.r, this.p.n / 2, 0.5)
    return x1 * this.p.n / (x2 * this.p.m)
  }

  _pdf (x) {
    let c = Math.pow(this.p.m / this.p.n, this.p.m / 2) * Math.pow(x, this.p.m / 2 - 1) / Math.pow(1 + this.p.m * x / this.p.n, 0.5 * (this.p.m + this.p.n))
    let z = c * Math.exp(logGamma(0.5 * (this.p.m + this.p.n)) - logGamma(this.p.m / 2) - logGamma(this.p.n / 2))
    let dz
    for (let r = 1; r < 100; r++) {
      // Update coefficients
      c *= 0.5 * this.p.lambda * (this.p.m / this.p.n) * (x / (1 + this.p.m * x / this.p.n)) / r

      // TODO Remove gamma and use fast update of coefficients
      dz = c * Math.exp(logGamma(0.5 * (this.p.m + this.p.n) + r) - logGamma(this.p.m / 2 + r) - logGamma(this.p.n / 2))
      z += dz

      if (Math.abs(dz / z) < EPS) {
        return Math.exp(-0.5 * this.p.lambda) * z
      }
    }
  }

  _cdf (x) {
    let c = 1
    let y = this.p.m * x / this.p.n
    let q = y / (1 + y)
    let z = regularizedBetaIncomplete(this.p.m / 2, this.p.n / 2, q)
    let dz
    for (let r = 1; r < 100; r++) {
      // Update coefficients
      c *= 0.5 * this.p.lambda / r

      // TODO Remove beta and use fast update of coefficients
      dz = c * regularizedBetaIncomplete(this.p.m / 2 + r, this.p.n / 2, q)
      z += dz

      if (Math.abs(dz / z) < EPS) {
        return Math.exp(-0.5 * this.p.lambda) * z
      }
    }
  }
}
