import { beta } from '../special'
import Distribution from './_distribution'

export default class extends Distribution {
  constructor (rho = 1) {
    super('discrete', arguments.length)
    this.p = { rho }
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: null,
      closed: false
    }]
  }

  _generator () {
    let e1 = -Math.log(Math.random())
    let e2 = -Math.log(Math.random())
    return Math.ceil(-e1 / Math.log(1 - Math.exp(-e2 / this.p.rho)))
  }

  _pdf (x) {
    return this.p.rho * beta(x, this.p.rho + 1)
  }

  _cdf (x) {
    return 1 - x * beta(x, this.p.rho + 1)
  }
}
