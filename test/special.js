import { assert } from 'chai'
import { describe, it } from 'mocha'
import { besselInu } from '../src/special/bessel'
import { erf } from '../src/special/error'
import { f11 } from '../src/special/hypergeometric'
import gamma from '../src/special/gamma'
import logGamma from '../src/special/log-gamma'
import { gammaLowerIncomplete, gammaUpperIncomplete } from '../src/special/gamma-incomplete'
import hurwitzZeta from '../src/special/hurwitz-zeta'
import { lambertW0 } from '../src/special/lambert-w'
import marcumQ from '../src/special/marcum-q'
import owenT from '../src/special/owen-t'
import riemannZeta from '../src/special/riemann-zeta'
import utils from './test-utils'

const LAPS = 100
const PRECISION = 1e-10

function equal (x, y) {
  return Math.abs((x - y) / y) < PRECISION
}

describe('special', () => {
  /*
  describe('digamma(z)', () => {
    it('should return reference values', () => {
      assert(equal(digamma(1), -em))
      assert(equal(digamma(0.5), -em - 2 * Math.log(2)))
      assert(equal(digamma(1 / 4), -Math.PI / 2 - 3 * Math.log(2) - em))
    })

    it('should give the harmonic number for integers', () => {
      utils.repeat(() => {
        let z = Math.floor(Math.random() * 100) + 1
        assert(equal(digamma(z), digamma(z + 1) - 1 / z))
      }, LAPS)
    })
  })

  describe('f21(a, b, c, z)', () => {
    describe('z < -1', () => {
      it('TEST', () => {
        let z = 1 + Math.random() * 10
        console.log(
          f21(0.5, 0.5, 1.5, -z * z),
          Math.log(z + Math.sqrt(1 + z * z)) / z
        )
      })
    })

    describe('-1 <= z < 0', () => {
    })

    describe('0 <= z <= 0.5', () => {

    })

    describe('0.5 < z <= 1', () => {})

    describe('1 < z <= 2', () => {})

    describe('2 < z', () => {

    })
  })
  */

  describe('f11(a, b, z)', () => {
    describe('|z| < 50', () => {
      it('f11(0, b, z) = 1', () => {
        utils.repeat(() => {
          let b = Math.random()
          let z = Math.random() * 40
          assert(equal(f11(0, b, z), 1))
        }, LAPS)
      })

      it('f11(b, b, z) = exp(z)', () => {
        utils.repeat(() => {
          let b = Math.random() * 10
          let z = Math.random() * 40
          assert(equal(f11(b, b, z), Math.exp(z)))
        }, LAPS)
      })

      it('f11(2, 1, z) = (1 + z) * exp(z)', () => {
        utils.repeat(() => {
          let z = Math.random() * 40
          assert(equal(f11(2, 1, z), (1 + z) * Math.exp(z)))
        }, LAPS)
      })

      it('f11(1, 2, z) = (exp(z) - 1) / z', () => {
        utils.repeat(() => {
          let z = Math.random() * 40
          assert(equal(f11(1, 2, z), (Math.exp(z) - 1) / z))
        }, LAPS)
      })

      it('(2z / sqrt(pi)) * f11(0.5, 1.5, -z^2) = erf(z)', () => {
        utils.repeat(() => {
          let z = Math.random()
          assert(equal(2 * z * f11(0.5, 1.5, -z * z) / Math.sqrt(Math.PI), erf(z)))
        }, LAPS)
      })

      it('f11(a, 2a, z) = exp(z/2) (z/4)^(0.5 - a) gamma(a + 0.5) I(a - 0.5; z/2)', () => {
        utils.repeat(() => {
          let a = Math.random() * 10
          let z = Math.random() * 40
          assert(equal(
            f11(a, 2 * a, z),
            Math.exp(z / 2 + (0.5 - a) * Math.log(z / 4) + logGamma(a + 0.5)) * besselInu(a - 0.5, z / 2)
          ))
        }, LAPS)
      })

      it('a f11(a+1, b, z) = (b - a) f11(a-1, b, z) + (2a - b + z) f11(a, b, z)', () => {
        utils.repeat(() => {
          let a = Math.random() * 10
          let b = Math.random() * 10
          let z = Math.random() * 40
          assert(equal(
            a * f11(a + 1, b, z),
            (b - a) * f11(a - 1, b, z) + (2 * a - b + z) * f11(a, b, z)
          ))
        }, LAPS)
      })
    })

    describe('|z| >= 50', () => {
      it('f11(0, b, z) = 1', () => {
        utils.repeat(() => {
          let b = Math.random()
          let z = Math.random() * 40 + 50
          assert(equal(f11(0, b, z), 1))
        }, LAPS)
      })

      it('f11(b, b, z) = exp(z)', () => {
        utils.repeat(() => {
          let b = Math.random() * 10
          let z = Math.random() * 40 + 50
          assert(equal(f11(b, b, z), Math.exp(z)))
        }, LAPS)
      })

      it('f11(2, 1, z) = (1 + z) * exp(z)', () => {
        utils.repeat(() => {
          let z = Math.random() * 40 + 50
          assert(equal(f11(2, 1, z), (1 + z) * Math.exp(z)))
        }, LAPS)
      })

      it('f11(1, 2, z) = (exp(z) - 1) / z', () => {
        utils.repeat(() => {
          let z = Math.random() * 40 + 50
          assert(equal(f11(1, 2, z), (Math.exp(z) - 1) / z))
        }, LAPS)
      })

      it('f11(a, 2a, z) = exp(z/2) (z/4)^(0.5 - a) gamma(a + 0.5) I(a - 0.5; z/2)', () => {
        utils.repeat(() => {
          let a = Math.random() * 10
          let z = Math.random() * 40 + 50
          assert(equal(
            f11(a, 2 * a, z),
            Math.exp(z / 2 + (0.5 - a) * Math.log(z / 4) + logGamma(a + 0.5)) * besselInu(a - 0.5, z / 2)
          ))
        }, LAPS)
      })

      it('a f11(a+1, b, z) = (b - a) f11(a-1, b, z) + (2a - b + z) f11(a, b, z)', () => {
        utils.repeat(() => {
          let a = Math.random() * 10 + 3
          let b = Math.random() * 10 + 3
          let z = Math.random() * 40 + 50
          assert(equal(
            a * f11(a + 1, b, z),
            (b - a) * f11(a - 1, b, z) + (2 * a - b + z) * f11(a, b, z)
          ))
        }, LAPS)
      })
    })
  })

  describe('hurwitzZeta(s, a), riemannZeta(s)', () => {
    it('riemannZeta(s) - hurwitzZeta(s, n+1) should give H(s, n)', () => {
      utils.repeat(() => {
        let s = Math.random() * 10 + 1
        let sum = 0
        for (let n = 1; n < 100; n++) {
          sum += 1 / Math.pow(n, s)
          assert(Math.abs(sum - riemannZeta(s) + hurwitzZeta(s, n + 1)) / sum < 1e-6)
        }
      }, LAPS)
    })
  })

  describe('gamma(z), logGamma(z)', () => {
    it('logGamma(z) should be equal to ln(gamma(z))', () => {
      for (let i = 0; i < LAPS; i++) {
        let x = Math.random() * 100

        let g = gamma(x)

        let lng = logGamma(x)
        assert(Math.abs(Math.log(g) - lng) / lng < 0.01)
      }
    })
  })

  describe('gammaLowerIncomplete(s, x), gammaUpperIncomplete(s, x)', () => {
    it('should vanish below 0', () => {
      utils.repeat(() => {
        let s = 2 + Math.random() * 10

        let x = -10
        assert(gammaLowerIncomplete(s, x) === 0)
      }, LAPS)
    })
    it('should be equal to exp(-x) for s = 1', () => {
      utils.repeat(() => {
        let x = Math.random() * 100

        let gui = gammaUpperIncomplete(1, x) * gamma(1)
        assert(Math.abs(gui - Math.exp(-x)) / gui < 0.01)
      }, LAPS)
    })

    it('should be equal to sqrt(pi) * erf(sqrt(x)) for s = 1/2', () => {
      utils.repeat(() => {
        let x = Math.random() * 100

        let gli = gammaLowerIncomplete(0.5, x) * gamma(0.5)
        assert(Math.abs(gli - Math.sqrt(Math.PI) * erf(Math.sqrt(x))) / gli < 0.01)
      }, LAPS)
    })

    it('should converge to x^s / s as x -> 0', () => {
      for (let i = 0; i < LAPS; i++) {
        let s = Math.random()

        let x = 1e-5 * (1 + Math.random())

        let xs = Math.pow(x, s)

        let gli = gammaLowerIncomplete(s, x) * gamma(s)
        if (xs > 1e-100) {
          assert(Math.abs(gli / Math.pow(x, s) * s - 1) < 0.01)
        }
      }
    })

    it('should converge to gamma(s) as x -> inf', () => {
      for (let i = 0; i > LAPS; i++) {
        let s = Math.random() * 100
        let x = 1e5 + Math.random() * 1e5
        assert(equal(gammaLowerIncomplete(s, x), 1))
      }
    })
  })

  describe('lambertW0(z)', () => {
    it('should satisfy the W * exp(W) = x equation', () => {
      utils.repeat(() => {
        let x = Math.random() * 10
        let w = lambertW0(x)
        assert(equal(w * Math.exp(w), x))
      }, LAPS)
    })
  })

  describe('marcumQ(mu, x, y)', () => {
    describe('special cases', () => {
      describe('x = 0', () => {
        it('should satisfy the recurrence relation', () => {
          let x = Math.random() * 30
          let y = 0
          let mu = 2 + Math.random() * 5

          assert(equal(marcumQ(mu, x, y), 1))
        })
      })

      describe('y = 1', () => {
        it('should satisfy the recurrence relation', () => {
          utils.repeat(() => {
            let x = 0
            let y = 40 + Math.random() * 60
            let mu = 2 + Math.random() * 5

            assert(equal(marcumQ(mu, x, y), gammaUpperIncomplete(mu, y)))
          }, LAPS)
        })
      })
    })

    describe('series expansion', () => {
      describe('Q', () => {
        it('should satisfy the recurrence relation', () => {
          utils.repeat(() => {
            let x = Math.random() * 30
            let y = 40 + Math.random() * 60
            let mu = 2 + Math.random() * 5
            // console.log(x < 30, y >= x + mu)
            // return

            let q1 = marcumQ(mu + 1, x, y)
            let q2 = marcumQ(mu, x, y)
            let q3 = marcumQ(mu + 2, x, y)
            let q4 = marcumQ(mu - 1, x, y)

            if (x > mu) {
              assert(equal(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4), 1))
            } else {
              assert(equal(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4), 1))
            }
          }, LAPS)
        })
      })

      describe('P', () => {
        it('should satisfy the recurrence relation', () => {
          utils.repeat(() => {
            let x = Math.random() * 30
            let y = 10 + Math.random() * 10
            let mu = 30 + Math.random() * 5
            // console.log(x < 30, y < x + mu)
            // return

            let q1 = marcumQ(mu + 1, x, y)
            let q2 = marcumQ(mu, x, y)
            let q3 = marcumQ(mu + 2, x, y)
            let q4 = marcumQ(mu - 1, x, y)

            if (x > mu) {
              assert(equal(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4), 1))
            } else {
              assert(equal(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4), 1))
            }
          }, LAPS)
        })
      })
    })

    /*
    describe('asymptotic expansion for large xi', () => {
      describe('Q', () => {
        it('should satisfy the recurrence relation', () => {
          utils.repeat(() => {
            let x = 40 + Math.random() * 10
            let y = 60 + Math.random() * 10
            let mu = 2 + Math.random() * 5
            //let xi = 2 * Math.sqrt(x * y)
            //console.log(x >= 30, xi > 30, mu * mu < 2 * xi, y >= x + mu)
            //return

            let q1 = marcumQ(mu + 1, x, y)
            let q2 = marcumQ(mu, x, y)
            let q3 = marcumQ(mu + 2, x, y)
            let q4 = marcumQ(mu - 1, x, y)

            if (x > mu) {
              assert(Math.abs(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4) - 1) < PRECISION)
            } else {
              assert(Math.abs(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4) - 1) < PRECISION)
            }
          }, LAPS)
        })
      })

      describe('P', () => {
        it('should satisfy the recurrence relation', () => {
          utils.repeat(() => {
            let x = 40 + Math.random() * 10
            let y = 30 + Math.random() * 10
            let mu = 2 + Math.random() * 5
            //let xi = 2 * Math.sqrt(x * y)
            //console.log(x >= 30, xi > 30, mu * mu < 2 * xi, y < x + mu)
            //return

            let q1 = marcumQ(mu + 1, x, y)
            let q2 = marcumQ(mu, x, y)
            let q3 = marcumQ(mu + 2, x, y)
            let q4 = marcumQ(mu - 1, x, y)

            if (x > mu) {
              assert(Math.abs(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4) - 1) < PRECISION)
            } else {
              assert(Math.abs(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4) - 1) < PRECISION)
            }
          }, LAPS)
        })
      })
    })

    /*describe('recurrence relation', () => {
      describe('Q', () => {
        it('should satisfy the recurrence relation', () => {
          utils.repeat(() => {
            let x = 40 + Math.random() * 10
            let mu = 100 + Math.random() * 10
            let s = Math.sqrt(4 * x + 2 * mu) - 5
            let f1 = x + mu - s
            let f2 = x + mu + s
            let y = f1 + (f2 - f1) * (0.9 + 0.1 * Math.random())
            //let xi = 2 * Math.sqrt(x * y)
            //console.log(x >= 30, xi > 30, mu * mu > 2 * xi, f1 < y, y < f2, y > x + mu)
            //return

            let q1 = marcumQ(mu + 1, x, y)
            let q2 = marcumQ(mu, x, y)
            let q3 = marcumQ(mu + 2, x, y)
            let q4 = marcumQ(mu - 1, x, y)

            if (x > mu) {
              assert(Math.abs(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4) - 1) < PRECISION)
            } else {
              assert(Math.abs(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4) - 1) < PRECISION)
            }
          }, LAPS)
        })
      })

      describe('P', () => {
        it('should satisfy the recurrence relation', () => {
          utils.repeat(() => {
            let x = 40 + Math.random() * 10
            let mu = 100 + Math.random() * 10
            let s = Math.sqrt(4 * x + 2 * mu) - 5
            let f1 = x + mu - s
            let f2 = x + mu + s
            let y = f1 + 0.1 * (f2 - f1) * Math.random()
            //let xi = 2 * Math.sqrt(x * y)
            //console.log(x >= 30, xi > 30, mu * mu > 2 * xi, f1 < y, y < f2, mu < 135, y < x + mu)
            //return

            let q1 = marcumQ(mu + 1, x, y)
            let q2 = marcumQ(mu, x, y)
            let q3 = marcumQ(mu + 2, x, y)
            let q4 = marcumQ(mu - 1, x, y)

            if (x > mu) {
              assert(Math.abs(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4) - 1) < PRECISION)
            } else {
              assert(Math.abs(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4) - 1) < PRECISION)
            }
          }, LAPS)
        })
      })
    })
    */
  })

  describe('owenT(h, a)', () => {
    it('should return reference values', () => {
      [
        {h: 0.0625, a: 0.25, t: 0.03891193023470137},
        {h: 6.5, a: 0.4375, t: 2.0005773048508314e-11},
        {h: 7, a: 0.96875, t: 6.399062719389869e-13},
        {h: 4.78125, a: 0.0625, t: 1.0632974804687463e-7},
        {h: 2, a: 0.5, t: 0.008625077985521507},
        {h: 1, a: 0.9999975, t: 0.0667418089782286},
        {h: 1, a: 0.5, t: 0.04306469112078537},
        {h: 1, a: 1, t: 0.06674188216570097},
        {h: 1, a: 2, t: 0.0784681869930841},
        {h: 1, a: 3, t: 0.0792995047488726},
        {h: 0.5, a: 0.5, t: 0.06448860284750375},
        {h: 0.5, a: 1, t: 0.1066710629614485},
        {h: 0.5, a: 2, t: 0.1415806036539784},
        {h: 0.5, a: 3, t: 0.1510840430760184},
        {h: 0.25, a: 0.5, t: 0.07134663382271778},
        {h: 0.25, a: 1, t: 0.1201285306350883},
        {h: 0.25, a: 2, t: 0.1666128410939293},
        {h: 0.25, a: 3, t: 0.1847501847929859},
        {h: 0.125, a: 0.5, t: 0.07317273327500386},
        {h: 0.125, a: 1, t: 0.1237630544953746},
        {h: 0.125, a: 2, t: 0.1737438887583106},
        {h: 0.125, a: 3, t: 0.1951190307092811},
        {h: 0.0078125, a: 0.5, t: 0.07378938035365545},
        {h: 0.0078125, a: 1, t: 0.1249951430754052},
        {h: 0.0078125, a: 2, t: 0.1761984774738108},
        {h: 0.0078125, a: 3, t: 0.1987772386442824},
        {h: 0.0078125, a: 10, t: 0.2340886964802671},
        {h: 0.0078125, a: 100, t: 0.2479460829231492}
        ].forEach(d => {
          assert(equal(owenT(d.h, d.a), d.t))
      })
    })
  })
})
