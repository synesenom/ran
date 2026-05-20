import Distribution from './_distribution'

export default class extends Distribution {
  constructor (alpha, lambda, x0) {
    super('continuous', 3)

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
