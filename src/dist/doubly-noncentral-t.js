import startIndex from '../algorithms/start-index'
import gamma from '../special/gamma'
import logGamma from '../special/log-gamma'
import Distribution from './_distribution'
import { noncentralChi2, normal } from './_core'
import { f11 } from '../special/hypergeometric'
import acceleratedSum from '../algorithms/accelerated-sum'
import recursiveSum from '../algorithms/recursive-sum'
import NoncentralT from './noncentral-t'

/**
 * Generator for the [doubly non-central t distribution]{@link https://cran.r-project.org/web/packages/sadists/sadists.pdf}:
 *
 * $$f(x; \nu, \mu, \theta) = \frac{e^{-\frac{\theta + \mu^2}{2}}}{\sqrt{\pi \nu}} \sum_{j = 0}^\infty \frac{1}{j!} \frac{(x \mu \sqrt{2 / \nu})^j}{(1 + x^2 / \nu)^{\frac{\nu + j + 1}{2}}} \frac{\Gamma\big(\frac{\nu + j + 1}{2}\big)}{\Gamma\big(\frac{\nu}{2}\big)} {}_1F_1\bigg(\frac{\nu + j + 1}{2}, \frac{\nu}{2}; \frac{\theta}{2 (1 + x^2 / \nu)}\bigg),$$
 *
 * where \(\nu \in \mathbb{N}^+\), \(\mu \in \mathbb{R}\) and \(\theta > 0\). Support: \(x \in \mathbb{R}\).
 *
 * @class DoublyNoncentralT
 * @memberOf ran.dist
 * @param {number} nu Degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 1.
 * @param {number} mu Location parameter. Default value is 1.
 * @param {number} theta Shape parameter. Default value is 1.
 * @constructor
 */
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

    // Speed-up constants
    this.c = [
      -0.5 * (theta + mu * mu + Math.log(Math.PI * nui)) - logGamma(nui / 2)
    ]
  }

  /**
   * Advances the hypergeometric function forward in its first argument.
   *
   * @method _f11Forward
   * @methodOf ran.dist.DoublyNoncentralT
   * @param {number} f1 Function value for one iteration before.
   * @param {number} f2 Function value for two iterations before.
   * @param {number} a First argument.
   * @param {number} b Second argument.
   * @param {number} z Third argument.
   * @returns {number} The function value at the current iteration.
   * @private
   */
  _f11Forward (f1, f2, a, b, z) {
    return ((2 * a - b + z) * f1 + (b - a) * f2) / a
  }

  /**
   * Advances the hypergeometric function backward in its first argument.
   *
   * @method _f11Backward
   * @methodOf ran.dist.DoublyNoncentralT
   * @param {number} f1 Function value for one iteration ahead.
   * @param {number} f2 Function value for two iterations ahead.
   * @param {number} a First argument.
   * @param {number} b Second argument.
   * @param {number} z Third argument.
   * @returns {number} The function value at the current iteration.
   * @private
   */
  _f11Backward (f1, f2, a, b, z) {
    return (a * f2 - (2 * a - b + z) * f1) / (b - a)
  }

  /**
   * Logarithm of the term in the probability density function.
   *
   * @method _logA
   * @methodOf ran.dist.DoublyNoncentralT
   * @param {number} x Value to evaluate density at.
   * @param {number} j Index of the term to evaluate.
   * @returns {number} The logarithm of the term.
   * @private
   */
  _logA (x, j) {
    let tk = 1 + x * x / this.p.nu
    let kj = (this.p.nu + j + 1) / 2
    return j * Math.log(Math.abs(x * this.p.mu / Math.sqrt(this.p.nu / 2))) +
      logGamma(kj) -
      kj * Math.log(tk) -
      logGamma(j + 1) +
      Math.log(f11(kj, this.p.nu / 2, this.p.theta / (2 * tk)))
  }

  _generator () {
    // Direct sampling from a normal and a non-central chi2
    let x = normal(this.r, this.p.mu)
    let y = noncentralChi2(this.r, this.p.nu, this.p.theta)
    return x / Math.sqrt(y / this.p.nu)
  }

  _pdf (x) {
    // Some pre-computed constants
    let nu2 = this.p.nu / 2
    let tk = 1 + x * x / this.p.nu
    let srtk = Math.sqrt(tk)
    let lntk = Math.log(tk)
    let tmuk = Math.abs(x * this.p.mu / Math.sqrt(nu2))
    let lntmuk = Math.log(tmuk)
    let thetatk = this.p.theta / (2 * tk)

    // Find index with highest amplitude
    let j0 = startIndex(j => this._logA(x, j))

    let z = 0
    if (x * this.p.mu >= 0) {
      // Init terms
      let kj0 = (this.p.nu + j0 + 1) / 2
      let gp = Math.exp(
        this.c[0] +
        j0 * lntmuk -
        logGamma(j0 + 1) -
        kj0 * lntk
      )
      let gk0 = gamma(kj0)
      let f10 = f11(kj0, nu2, thetatk)

      // Forward
      z = recursiveSum({
        gp,
        gk: [
          gk0,
          gamma(kj0 - 0.5)
        ],
        g: gp * gk0,
        f1: [
          f10,
          f11(kj0 - 0.5, nu2, thetatk)
        ],
        f2: [
          f11(kj0 - 1, nu2, thetatk),
          f11(kj0 - 1.5, nu2, thetatk)
        ],
        f: f10
      }, (t, i) => {
        let j = j0 + i
        let j2 = i % 2
        let kj = (this.p.nu + j + 1) / 2
        t.gp *= tmuk / (j * srtk)
        t.gk[j2] *= kj - 1
        t.g = t.gp * t.gk[j2]

        t.f = this._f11Forward(t.f1[j2], t.f2[j2], kj - 1, nu2, thetatk)
        t.f2[j2] = t.f1[j2]
        t.f1[j2] = t.f
        return t
      }, t => t.g * t.f)

      // Backward
      if (j0 > 0) {
        kj0 -= 0.5
        gp *= j0 * srtk / tmuk
        gk0 = gamma(kj0)
        f10 = f11(kj0, nu2, thetatk)
        z += recursiveSum({
          gp: gp,
          gk: [
            gk0,
            gamma(kj0 + 0.5)
          ],
          g: gp * gk0,
          f1: [
            f10,
            f11(kj0 + 0.5, this.p.nu / 2, thetatk)
          ],
          f2: [
            f11(kj0 + 1, this.p.nu / 2, thetatk),
            f11(kj0 + 1.5, this.p.nu / 2, thetatk)
          ],
          f: f10
        }, (t, i) => {
          let j = j0 - i
          if (j > 0) {
            let j2 = i % 2
            let kj = (this.p.nu + j) / 2

            t.gp /= tmuk / (j * srtk)
            t.gk[j2] /= kj
            t.g = t.gp * t.gk[j2]

            t.f = this._f11Backward(t.f1[j2], t.f2[j2], kj + 1, nu2, thetatk)
            t.f2[j2] = t.f1[j2]
            t.f1[j2] = t.f
          } else {
            t.g = 0
            t.f = 0
          }
          return t
        }, t => t.g * t.f)
      }
    } else {
      // Forward
      let kj0 = (this.p.nu + j0 + 1) / 2
      let gp0 = Math.exp(
        this.c[0] +
        (j0 - 1) * lntmuk -
        logGamma(j0) -
        (kj0 - 0.5) * lntk
      )
      let gk0 = gamma(kj0 - 1)
      let gk1 = gamma(kj0 - 0.5)
      let gk = [gk0, gk1]
      let f2 = [
        f11(kj0 - 2, nu2, thetatk),
        f11(kj0 - 1.5, nu2, thetatk)
      ]
      let f1 = [
        f11(kj0 - 1, nu2, thetatk),
        f11(kj0 - 0.5, nu2, thetatk)
      ]

      let gp = gp0
      z += acceleratedSum(i => {
        let j = j0 + i
        let j2 = i % 2
        let kj = (this.p.nu + j + 1) / 2

        gp *= tmuk / (j * srtk)
        gk[j2] *= kj - 1
        let g = gp * gk[j2]

        let f = this._f11Forward(f1[j2], f2[j2], kj - 1, nu2, thetatk)
        f2[j2] = f1[j2]
        f1[j2] = f

        return g * f
      })

      // Backward
      if (j0 > 0) {
        kj0 -= 0.5
        let gp = gp0 * tmuk / (j0 * srtk)
        gk = [gk1 * kj0, gk0 * (kj0 - 0.5)]
        f2 = [
          f11(kj0 + 2, nu2, thetatk),
          f11(kj0 + 1.5, nu2, thetatk)
        ]
        f1 = [
          f11(kj0 + 1, nu2, thetatk),
          f11(kj0 + 0.5, nu2, thetatk)
        ]
        z -= acceleratedSum(i => {
          let j = j0 - i
          let j2 = i % 2
          let kj = (this.p.nu + j) / 2
          let dz = 0

          if (j > 0) {
            gp /= tmuk / (j * srtk)
            gk[j2] /= kj
            let g = gp * gk[j2]

            let f = this._f11Backward(f1[j2], f2[j2], kj + 1, nu2, thetatk)
            f2[j2] = f1[j2]
            f1[j2] = f

            dz = g * f
          }

          return dz
        })
      }
    }

    return Math.abs(z)
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
