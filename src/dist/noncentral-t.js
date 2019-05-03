import recursiveSum from '../algorithms/recursive-sum'
import betaFn from '../special/beta'
import gammaFn from '../special/gamma'
import logGamma from '../special/log-gamma'
import { regularizedBetaIncomplete } from '../special/beta-incomplete'
import { normal, gamma } from './_core'
import Distribution from './_distribution'
import { erf } from '../special/error'

export default class extends Distribution {
  constructor (nu = 1, mu = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    let nui = Math.round(nu)
    this.p = { mu, nu: nui }
    Distribution._validate({ mu, nu: nui }, [
      'nu > 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: true
    }]
  }

  _generator () {
    // Direct sampling from a normal and a chi2
    let x = normal(this.r)
    let y = gamma(this.r, this.p.nu / 2, 0.5)
    return (x + this.p.mu) / Math.sqrt(y / this.p.nu)
  }

  _pdf (x) {
    let y = Math.sqrt(1 + x * x / this.p.nu)
    let d = 0.5 * (this.p.nu + 1)
    let c = Math.exp(-2 * d * Math.log(y) + logGamma(d))
    let z = c
    let j
    for (j = 1; j < 100; j++) {
      // Update term
      c *= x * this.p.mu * (d + j) / (j * y * Math.sqrt(this.p.nu / 2))

      // Update sum
      let dz = c
      z += dz

      if (Math.abs(dz / z) < Number.EPSILON) {
        break
      }
    }

    return Math.exp(-0.5 * this.p.mu * this.p.mu) * z * Math.exp(-0.5 * Math.log(Math.PI * this.p.nu) - logGamma(this.p.nu / 2))
  }

  _cdf (x) {
    /*let phi = 0.5 * (1 + erf(-x * Math.SQRT1_2))
    if (x === 0) {
      return phi
    }
    let d = this.p.mu * this.p.mu / 2
    let y = x * x / (x * x + this.p.nu)

    let j0 = Math.floor(d)
    let pf = Math.exp(-d + j0 * Math.log(d) - logGamma(j0 + 1))
    let qf = Math.exp(-d + j0 * Math.log(d) - logGamma(j0 + 1.5))
    let apf = j0 + 0.5
    let aqf = j0 + 1
    let b = this.p.nu / 2
    let xapf = Math.pow(y, apf)
    let xaqf = Math.pow(y, aqf)
    let xb = Math.pow(1 - y, b)
    let bxypf = betaFn(apf, b)
    let bxyqf = betaFn(aqf, b)
    let ixpf = regularizedBetaIncomplete(apf, b, y)
    let ixqf = regularizedBetaIncomplete(aqf, b, y)
    let z = x > 0 ? pf * ixpf + this.p.nu * qf * ixqf / Math.SQRT2 : pf * ixpf - this.p.nu * qf * ixqf / Math.SQRT2

    // console.log(pf, qf, xapf, xaqf, ixpf, ixqf)
    for (let j = j0 + 1; j < 100; j++) {
      // Multipliers
      pf *= d / j
      qf *= d / (j + 1.5)

      // Incomplete gamma
      ixpf -= xapf * xb / bxypf
      ixqf -= xaqf * xb / bxyqf
      bxypf *= apf / (apf + b)
      bxyqf *= aqf / (aqf + b)
      xapf *= y
      xaqf *= y
      apf++
      aqf++

      // Update sum
      let dz = pf * ixpf + this.p.nu * qf * ixqf / Math.SQRT2
      z += dz

      if (Math.abs(dz / z) < Number.EPSILON) {
        break
      }
    }

    z = phi + z / 2
    console.log(z)
    return x > 0 ? z : 1 - z*/

    let s1 = 1
    let s2 = x >= 0 ? 1 : -1
    let d = 0.5 * this.p.mu * this.p.mu
    let q = 1 + x * x / this.p.nu
    let a = 0.5
    let b = this.p.nu / 2
    let xa = Math.pow(q, a)
    let xb = Math.pow(1 - q, b)
    let bxy = betaFn(a, b)
    let ix = regularizedBetaIncomplete(a, b, q)
    let c = 0.5 * gammaFn(0.5)
    let z = c

    let j
    for (j = 1; j < 100; j++) {
      ix -= xa * xb / bxy
      bxy *= a / (a + b)
      xa *= q
      a++
      s1 = -s1
      s2 = x < 0 && j % 2 === 0 ? -1 : 1
      c *= this.p.mu * Math.SQRT1_2 * (j + 0.5) * (s1 + s2 * ix) / j

      // Update sum
      let dz = c
      z += dz

      if (Math.abs(dz / z) < Number.EPSILON) {
        break
      }
    }

    return Math.exp(-d) * z / Math.sqrt(Math.PI)
  }
}