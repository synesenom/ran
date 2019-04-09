import { betaIncomplete } from '../special/beta-incomplete'
import Distribution from './_distribution'

export default class extends Distribution {
  constructor (p = 0.5) {
    super('discrete', arguments.length)
    this.p = { p }
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    // Direct sampling
    return Math.floor(1 + Math.log(this.r.next()) / Math.log(1 - Math.pow(1 - this.p.p, this.r.next())))
  }

  _pdf (x) {
    return -Math.pow(this.p.p, x) / (x * Math.log(1 - this.p.p))
  }

  _cdf (x) {
    return 1 + betaIncomplete(x + 1, 0, this.p.p) / Math.log(1 - this.p.p)
  }
}
