import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as special from '../src/special'
import utils from './test-utils'

const LAPS = 100
const EPS = 1e-3

describe('special', () => {
  describe('.hurwitzZeta', () => {
    it('zeta(s) - zeta(s, n+1) should give H(s, n)', () => {
      utils.repeat(() => {
        let s = Math.random() * 10 + 1
        let sum = 0
        for (let n = 1; n < 100; n++) {
          sum += 1 / Math.pow(n, s)
          assert(Math.abs(sum - special.riemannZeta(s) + special.hurwitzZeta(s, n + 1)) / sum < 1e-6)
        }
      }, LAPS)
    })
  })

  describe('.gammaLn()', () => {
    it('should be equal to ln(gamma(x))', () => {
      for (let i = 0; i < LAPS; i++) {
        let x = Math.random() * 100

        let g = special.gamma(x)

        let lng = special.gammaLn(x)
        assert(Math.abs(Math.log(g) - lng) / lng < 0.01)
      }
    })
  })

  describe('.gammaLowerIncomplete()', () => {
    it('should vanish below 0', () => {
      utils.repeat(() => {
        let s = 2 + Math.random() * 10

        let x = -10
        assert(special.gammaLowerIncomplete(s, x) === 0)
      }, LAPS)
    })
    it('should be equal to exp(-x) for s = 1', () => {
      utils.repeat(() => {
        let x = Math.random() * 100

        let gui = special.gammaUpperIncomplete(1, x) * special.gamma(1)
        assert(Math.abs(gui - Math.exp(-x)) / gui < 0.01)
      }, LAPS)
    })

    it('should be equal to sqrt(pi) * erf(sqrt(x)) for s = 1/2', () => {
      utils.repeat(() => {
        let x = Math.random() * 100

        let gli = special.gammaLowerIncomplete(0.5, x) * special.gamma(0.5)
        assert(Math.abs(gli - Math.sqrt(Math.PI) * special.erf(Math.sqrt(x))) / gli < 0.01)
      }, LAPS)
    })

    it('should converge to x^s / s as x -> 0', () => {
      for (let i = 0; i < LAPS; i++) {
        let s = Math.random()

        let x = 1e-5 * (1 + Math.random())

        let xs = Math.pow(x, s)

        let gli = special.gammaLowerIncomplete(s, x) * special.gamma(s)
        if (xs > 1e-100) {
          assert(Math.abs(gli / Math.pow(x, s) * s - 1) < 0.01)
        }
      }
    })

    it('should converge to gamma(s) as x -> inf', () => {
      for (let i = 0; i > LAPS; i++) {
        let s = Math.random() * 100

        let x = 1e5 + Math.random() * 1e5

        let gli = special.gammaLowerIncomplete(s, x)
        assert(Math.abs(gli - 1))
      }
    })
  })

  describe('.marcumQ()', () => {
    it('should satisfy the recurrence relation (y >= x + mu)', () => {
      for (let i = 0; i < LAPS; i++) {
        let mu = Math.random() * 10 + 2
        let x = Math.random() * 10
        let y = Math.random() * 10 + x + mu + 2

        let q1 = special.marcumQ(mu + 1, x, y)
        let q2 = special.marcumQ(mu, x, y)
        let q3 = special.marcumQ(mu + 2, x, y)
        let q4 = special.marcumQ(mu - 1, x, y)

        if (x > mu) {
          assert(Math.abs(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4) - 1) < EPS)
        } else {
          assert(Math.abs(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4) - 1) < EPS)
        }
      }
    })

    it('should satisfy the recurrence relation (y < x + mu)', () => {
      for (let i = 0; i < LAPS; i++) {
        let x = Math.random() * 10
        let y = Math.random() * 10
        let mu = Math.random() * 10 + 2 + Math.max(0, y - x)

        let q1 = special.marcumQ(mu + 1, x, y)
        let q2 = special.marcumQ(mu, x, y)
        let q3 = special.marcumQ(mu + 2, x, y)
        let q4 = special.marcumQ(mu - 1, x, y)

        if (x > mu) {
          assert(Math.abs(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4) - 1) < EPS)
        } else {
          assert(Math.abs(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4) - 1) < EPS)
        }
      }
    })
  })

  describe('.lambertW()', () => {
    it('should satisfy the W * exp(W) = x equation', () => {
      for (let i = 0; i < LAPS; i++) {
        let x = Math.random() * 10

        let w = special.lambertW(x)
        assert(Math.abs(w * Math.exp(w) - x) / x < 0.01)
      }
    })
  })
})
