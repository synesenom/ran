import { assert } from 'chai'
import { describe, it } from 'mocha'
import { erf, erfinv } from '../src/special/error'
import gamma from '../src/special/gamma'
import gammaLn from '../src/special/log-gamma'
import { gammaLowerIncomplete, gammaUpperIncomplete } from '../src/special/gamma-incomplete'
import hurwitzZeta from '../src/special/hurwitz-zeta'
import marcumQ from '../src/special/marcum-q'
import lambertW from '../src/special/lambert-w'
import riemannZeta from '../src/special/riemann-zeta'
import utils from './test-utils'

const LAPS = 100
const PRECISION = 1e-12

describe('special', () => {
  describe('.erfinv()', () => {
    it('should satisfy erf(erfinv(x)) = 1', () => {
      utils.repeat(() => {
        let x = 2 * Math.random() - 1
        assert(Math.abs(erf(erfinv(x)) - x) < PRECISION)
      }, LAPS)
    })
  })

  describe('.hurwitzZeta(), .riemannZeta()', () => {
    it('zeta(s) - zeta(s, n+1) should give H(s, n)', () => {
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

  describe('.gamma(), .logGamma()', () => {
    it('logGamma(x) should be equal to ln(gamma(x))', () => {
      for (let i = 0; i < LAPS; i++) {
        let x = Math.random() * 100

        let g = gamma(x)

        let lng = gammaLn(x)
        assert(Math.abs(Math.log(g) - lng) / lng < 0.01)
      }
    })
  })

  describe('.gammaLowerIncomplete(), .gammaUpperIncomplete()', () => {
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

        let gli = gammaLowerIncomplete(s, x)
        assert(Math.abs(gli - 1))
      }
    })
  })

  describe('.marcumQ()', () => {
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
              assert(Math.abs(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4) - 1) < PRECISION)
            } else {
              assert(Math.abs(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4) - 1) < PRECISION)
            }
          }, LAPS)
        })
      })
    })

    /*describe('asymptotic expansion for large xi', () => {
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
    })*/
  })

  describe('.lambertW()', () => {
    it('should satisfy the W * exp(W) = x equation', () => {
      utils.repeat(() => {
        let x = Math.random() * 10
        let w = lambertW(x)
        assert(Math.abs(w * Math.exp(w) - x) / x < 0.01)
      })
    })
  })
})
