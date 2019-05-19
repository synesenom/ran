import Distribution from './_distribution'

export default class extends Distribution {
  constructor (n1 = 2, n2 = 2, lambda1 = 1, lambda2 = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    let n1i = Math.round(n1)
    let n2i = Math.round(n2)
    this.p = { n1: n1i, n2: n2i, lambda1, lambda2 }
    Distribution._validate({ n1: n1i, n2: n2i, lambda1, lambda2 }, [
      'n1 > 0',
      'n2 > 0',
      'lambda1 > 0',
      'lambda2 > 0'
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
