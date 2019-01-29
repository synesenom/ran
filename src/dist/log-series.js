/* import { beta, betaIncomplete } from '../special'
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
    this.c = [-(1 - p) * Math.log(1 - p)] // = 1 / M, for the rejection sampling
  }

  _generator () {
    // Rejection sampling using geometric distribution
    for (let i=0; i<1000; i++) {
      // Generate geometric variate
      let y = Math.floor(Math.log(Math.random()) / Math.log(this.p.p))
      if (y === 0)
        continue
      let g = Math.pow(this.p.p, y) * (1 - this.p.p)

      // Rejection sample
      if (Math.random() < this.c[0] * this._pdf(y) / g) {
        return y
      }
    }
  }

  _pdf (x) {
    return -Math.pow(this.p.p, x) / (x * Math.log(1 - this.p.p))
  }

  _cdf (x) {
    return beta(x + 1, 0)
  }
}
*/
