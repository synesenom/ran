import Distribution from './_distribution'
import neumaier from '../algorithms/neumaier'
import gamma from '../special/gamma'
import { gammaUpperIncomplete } from '../special/gamma-incomplete'

// TODO Docs
export default class extends Distribution {
  constructor (n = 2) {
    super('continuous', arguments.length)

    // Validate parameters
    const ni = Math.round(n)
    this.p = { n: ni }
    Distribution.validate({ n: ni }, [
      'n > 1'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: true
    }]
  }

  _generator () {
    return Math.exp(neumaier(Array.from({ length: this.p.n }, () => Math.log(this.r.next()))))
  }

  _pdf (x) {
    return Math.pow(-Math.log(x), this.p.n - 1) / gamma(this.p.n)
  }

  _cdf (x) {
    return gammaUpperIncomplete(this.p.n, -Math.log(x))
  }
}
