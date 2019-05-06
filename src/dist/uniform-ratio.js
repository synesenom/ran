import Distribution from './_distribution'

export default class extends Distribution {
  constructor () {
    super('continuous', arguments.length)

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
    return this.r.next() / this.r.next()
  }

  _pdf (x) {
    return x <= 1 ? 0.5 : 0.5 / (x * x)
  }

  _cdf (x) {
    return x <= 1 ? 0.5 * x : 1 - 0.5 / x
  }

  _q (p) {
    return p <= 0.5 ? 2 * p : 0.5 / (1 - p)
  }
}
