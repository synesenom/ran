import { riemannZeta, gamma } from '../special'
import Distribution from './_distribution'
import { romberg } from '../algorithms'

export default class Davis extends Distribution {
  constructor (mu = 1, b = 1, n = 1.5) {
    super('continuous', arguments.length)

    // Validate parameters.
    this.p = { mu, b, n }
    Distribution.validate({ mu, b, n }, [
      'mu > 0',
      'b > 0',
      'n > 0', 'n != 1'
    ])

    // Set support.
    this.s = [{
      value: mu,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    return 1
  }

  _pdf (x) {
    return this.p.b ** this.p.n * Math.pow(x - this.p.mu, -1 - this.p.n) / gamma(this.p.n) / riemannZeta(this.p.n) / (Math.exp(this.p.b / (x - this.p.mu)) - 1)
  }

  _cdf (x) {
    if (x <= this.p.mu) {
      return 0
    }
    console.log(x, romberg(t => this._pdf(t), this.p.mu, x))
    return romberg(t => this._pdf(t), this.p.mu, x)
  }
}
