import { assert } from 'chai'
import { describe, it } from 'mocha'
import { erf } from '../src/special/error'
import gamma from '../src/special/gamma'
import gammaLn from '../src/special/gamma-log'
import { gammaLowerIncomplete, gammaUpperIncomplete } from '../src/special/gamma-incomplete'
import hurwitzZeta from '../src/special/hurwitz-zeta'
import marcumQ from '../src/special/marcum-q'
import lambertW from '../src/special/lambert-w'
import riemannZeta from '../src/special/riemann-zeta'
import utils from './test-utils'

const LAPS = 100
const EPS = 1e-3

describe('special', () => {
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

  describe('.gamma(), .gammaLn()', () => {
    it('gammaLn(x) should be equal to ln(gamma(x))', () => {
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
    describe('x < 30', () => {
      describe('Q(mu, x, y)', () => {
        it('should satisfy the recurrence relation', () => {
          for (let i = 0; i < LAPS; i++) {
            let mu = Math.random() * 10 + 2
            let x = Math.random() * 10
            let y = Math.random() * 10 + x + mu + 2

            let q1 = marcumQ(mu + 1, x, y)
            let q2 = marcumQ(mu, x, y)
            let q3 = marcumQ(mu + 2, x, y)
            let q4 = marcumQ(mu - 1, x, y)

            if (x > mu) {
              assert(Math.abs(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4) - 1) < EPS)
            } else {
              assert(Math.abs(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4) - 1) < EPS)
            }
          }
        })
      })

      describe('P(mu, x, y)', () => {
        it('should satisfy the recurrence relation (y < x + mu)', () => {
          for (let i = 0; i < LAPS; i++) {
            let x = Math.random() * 100
            let y = Math.random() * 100
            let mu = Math.random() * 100 + 2 + Math.max(0, y - x)

            let q1 = marcumQ(mu + 1, x, y)
            let q2 = marcumQ(mu, x, y)
            let q3 = marcumQ(mu + 2, x, y)
            let q4 = marcumQ(mu - 1, x, y)

            if (x > mu) {
              assert(Math.abs(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4) - 1) < EPS)
            } else {
              assert(Math.abs(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4) - 1) < EPS)
            }
          }
        })
      })
    })
  })

  describe('.lambertW()', () => {
    it('should satisfy the W * exp(W) = x equation', () => {
      for (let i = 0; i < LAPS; i++) {
        let x = Math.random() * 10

        let w = lambertW(x)
        assert(Math.abs(w * Math.exp(w) - x) / x < 0.01)
      }
    })
  })
})
