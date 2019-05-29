import Distribution from './_distribution'
import logBinomial from '../special/log-binomial'

export default class extends Distribution {
  // TODO Change to PreComputed
  constructor (n = 10) {
    super('discrete', arguments.length)

    // Validate parameters
    let ni = Math.round(n)
    this.p = { n: ni }
    Distribution._validate({ n: ni }, [
      'n >= 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 2 * ni,
      closed: true
    }]
  }

  _generator () {
    let heads = 0
    for (let i = 0; i < 2 * this.p.n; i++) {
      heads += this.r.next() > 0.5 ? 0 : 1
    }
    return Math.abs(heads - (2 * this.p.n - heads))
  }

  _pdf (x) {
    if (x === 0) {
      return Math.exp(2 * this.p.n * Math.log(0.5) + logBinomial(2 * this.p.n, this.p.n))
    } else {
      return x % 2 === 1
        ? 2 * Math.exp(2 * this.p.n * Math.log(0.5) + logBinomial(2 * this.p.n, x + this.p.n))
        : 0
    }
  }

  _cdf (x) {
    let cdf = 0
    for (let k = 0; k <= x; k++) {
      cdf += this._pdf(k)
    }
    return cdf
  }
}
