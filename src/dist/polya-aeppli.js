import Distribution from './_distribution'

export default class extends Distribution {
  constructor (lambda = 1, theta = 0.5) {
    super('discrete', arguments.length)

    // Validate parameters
    this.p = { lambda, theta }
    Distribution._validate({ lambda, theta }, [
      'lambda > 0',
      'theta > 0', 'theta < 1'
    ])

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

  }

  _pdf (x) {

  }

  _cdf (x) {

  }
}