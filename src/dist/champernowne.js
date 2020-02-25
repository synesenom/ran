import Distribution from './_distribution'

export default class extends Distribution {
  constructor (alpha = 1, lambda = 1, x0 = 0) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { alpha, lambda, x0 }
    Distribution.validate({ alpha, lambda, x0 }, [
      'alpha > 0',
      'lambda >= 0', 'lambda < 1'
    ])

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]

    this.c = [
      1
    ]
  }

  _generator () {

  }

  _pdf (x) {
    // TODO Add normalization factor
    return this.c[0] / (Math.cosh(this.p.alpha * (x - this.p.x0)) + this.p.lambda)
  }

  _cdf () {
    return this.c[0]
  }
}
