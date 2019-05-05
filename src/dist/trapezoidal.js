import Distribution from './_distribution'

export default class extends Distribution {
  constructor (a = 0, b = 0.33, c = 0.67, d = 1) {
    super('continuous', arguments.length)

    // Validate parameters
    this.p = { a, b, c, d }
    Distribution._validate({ a, b, c, d }, [
      'a < d',
      'a <= b', 'b < c',
      'c <= d'
    ])

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: d,
      closed: true
    }]

    // Speed-up constants
    this.c = [
      d + c - a - b,
      b - a,
      d - c,
      a + b
    ]
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    if (x < this.p.b) {
      return 2 * (x - this.p.a) / (this.c[1] * this.c[0])
    } else if (x < this.p.c) {
      return 2 / this.c[0]
    } else {
      return 2 * (this.p.d - x) / (this.c[2] * this.c[0])
    }
  }

  _cdf (x) {
    if (x < this.p.b) {
      return Math.pow(x - this.p.a, 2) / (this.c[1] * this.c[0])
    } else if (x < this.p.c) {
      return (2 * x - this.c[3]) / this.c[0]
    } else {
      return 1 - Math.pow(this.p.d - x, 2) / (this.c[2] * this.c[0])
    }
  }

  _q (p) {
    if (p < this.c[1] / this.c[0]) {
      return this.p.a + Math.sqrt(this.c[0] * this.c[1] * p)
    } else if (p < (2 * this.p.c - this.c[3]) / this.c[0]) {
      return (this.c[0] * p + this.c[3]) / 2
    } else {
      return this.p.d - Math.sqrt(this.c[0] * this.c[2] * (1 - p))
    }
  }
}