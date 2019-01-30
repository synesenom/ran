import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as special from '../src/special'
import utils from './test-utils'

const LAPS = 100

describe('special', () => {
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
        let s = Math.random() * 100

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
