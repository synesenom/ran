import gamma from '../special/gamma'
import logGamma from '../special/log-gamma'
import Distribution from './_distribution'
import { noncentralChi2, normal } from './_core'
import { EPS, MAX_ITER } from '../special/_core'
import { f11 } from '../special/hypergeometric'
import acceleratedSum from '../algorithms/accelerated-sum'
import recursiveSum from '../algorithms/recursive-sum'
import NoncentralT from './noncentral-t'

export default class extends Distribution {
  constructor (nu = 1, mu = 1, theta = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    let nui = Math.round(nu)
    this.p = { nu: nui, mu, theta }
    Distribution._validate({ nu: nui, mu, theta }, [
      'nu > 0',
      'theta >= 0'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling from a normal and a non-central chi2
    let x = normal(this.r, this.p.mu)
    let y = noncentralChi2(this.r, this.p.nu, this.p.theta)
    return x / Math.sqrt(y / this.p.nu)
  }

  _pdf (x) {
    // TODO Separate x * mu = 0 case
    // TODO Use outward iteration from some j0

    let tk = 1 + x * x / this.p.nu
    let srtk = Math.sqrt(tk)
    let c = [
      0.5 * (this.p.theta + this.p.mu * this.p.mu + Math.log(Math.PI * this.p.nu)) + logGamma(this.p.nu / 2),
      Math.abs(x * this.p.mu) * Math.sqrt(2 / this.p.nu),
      this.p.theta / (2 * tk),
      Math.abs(x * this.p.mu) * Math.sqrt(2 / this.p.nu) / srtk
    ]

    // Init Poisson and gamma terms
    let gp0 = Math.pow(srtk, -this.p.nu) * Math.exp(-c[0]) / c[1]
    // Even and odd terms
    let gk = [0, 0]
    let gp

    // Init hyper-geometric term
    // Even and odd terms
    let f1 = [0, 0]
    let f2 = [0, 0]
    let f

    let dz = 0
    let z = 0
    if (x * this.p.mu >= 0) {
      // x * mu > 0: normal sum
      for (let j = 0; j < MAX_ITER; j++) {
        let j2 = j % 2
        let kj = (this.p.nu + j + 1) / 2

        // Poisson and gamma terms
        gp0 *= c[3] / (j > 0 ? j : 1)
        gp = gp0
        if (j < 2) {
          gk[j2] = gamma(kj)
          gp *= gk[j2]
        } else {
          gk[j2] *= kj - 1
          gp *= gk[j2]
        }

        // Hyper-geometric terms
        if (j < 2) {
          // Init first terms of the recurrence relation
          f2[j2] = f11(kj, this.p.nu / 2, c[2])
          f = f2[j2]
        } else if (j < 4) {
          // Init second terms of the recurrence relation
          f1[j2] = f11(kj, this.p.nu / 2, c[2])
          f = f1[j2]
        } else {
          // Update terms
          f = ((this.p.nu / 2 - kj + 1) * f2[j2] + (2 * kj - 2 - this.p.nu / 2 + c[2]) * f1[j2]) / (kj - 1)
          f2[j2] = f1[j2]
          f1[j2] = f
        }

        // Update sum
        dz = gp * f
        z += dz

        // Check for stopping
        if (Math.abs(dz / z) < EPS) {
          break
        }
      }
    } else {
      // TODO Use outward summation
      // x * mu < 0: accelerated sum for alternating series
      z = acceleratedSum(j => {
        let j2 = j % 2
        let kj = (this.p.nu + j + 1) / 2

        // Poisson and gamma terms
        gp0 *= c[3] / (j > 0 ? j : 1)
        gp = gp0
        if (j < 2) {
          gk[j2] = gamma(kj)
          gp *= gk[j2]
        } else {
          gk[j2] *= kj - 1
          gp *= gk[j2]
        }

        // Hyper-geometric terms
        if (j < 2) {
          // Init first terms of the recurrence relation
          f2[j2] = f11(kj, this.p.nu / 2, c[2])
          f = f2[j2]
        } else if (j < 4) {
          // Init second terms of the recurrence relation
          f1[j2] = f11(kj, this.p.nu / 2, c[2])
          f = f1[j2]
        } else {
          // Update terms
          f = ((this.p.nu / 2 - kj + 1) * f2[j2] + (2 * kj - 2 - this.p.nu / 2 + c[2]) * f1[j2]) / (kj - 1)
          f2[j2] = f1[j2]
          f1[j2] = f
        }

        return gp * f
      }, 100)
    }

    return z
  }

  _cdf (x) {
    // Sum of the product of Poisson weights and singly non-central t CDF
    // Source: https://www.wiley.com/en-us/Intermediate+Probability%3A+A+Computational+Approach-p-9780470026373

    let y = Math.abs(x)
    let mu = x < 0 ? -this.p.mu : this.p.mu
    let z = recursiveSum({
      p: Math.exp(-this.p.theta / 2),
      f: NoncentralT.fnm(this.p.nu, mu, y)
    }, (t, i) => {
      let i2 = 2 * i
      t.p *= this.p.theta / i2
      t.f = NoncentralT.fnm(this.p.nu + i2, mu, y * Math.sqrt(1 + i2 / this.p.nu))
      return t
    }, t => t.p * t.f)
    return Math.min(1, Math.max(0, x < 0 ? 1 - z : z))
  }
}
