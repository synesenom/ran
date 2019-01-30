import Distribution from './_distribution'

export default class extends Distribution {
  constructor (a = 1, b = 2) {
    super('continuous', arguments.length)
    this.p = { a, b }
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }]
    this.c = [Math.log(a), Math.log(b)]
  }

  _generator () {
    return this.p.a * Math.exp((this.c[1] - this.c[0]) * Math.random())
  }

  _pdf (x) {
    return 1 / (x * (this.c[1] - this.c[0]))
  }

  _cdf (x) {
    return (Math.log(x) - this.c[0]) / (this.c[1] - this.c[0])
  }
}
