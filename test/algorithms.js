import { assert } from 'chai'
import { describe, it } from 'mocha'
import utils from './test-utils'
import lambertW from '../src/special/lambert-w'
import bracketing from '../src/algorithms/bracketing'
import brent from '../src/algorithms/brent'
import newton from '../src/algorithms/newton'
import neumaier from '../src/algorithms/neumaier'

const LAPS = 100
const PRECISION = 10 * Number.EPSILON

describe('algorithms', () => {
  describe('.bracketing()', () => {
    it('should return undefined if initial bracket is invalid', () => {
      utils.repeat(() => {
        const c = Math.random() * 10
        const bracket = bracketing(
          t => t * Math.exp(t) - c,
          lambertW(c) + 1,
          lambertW(c) + 1
        )
        assert(typeof bracket === 'undefined')
      }, LAPS)
    })

    it('should find an appropriate bracket for exp(-x) = c x', () => {
      utils.repeat(() => {
        const c = Math.random() * 10
        const bracket = bracketing(
          t => t * Math.exp(t) - c,
          lambertW(c) + 1,
          lambertW(c) + 2
        )
        assert(bracket[0] * Math.exp(bracket[0]) < c && bracket[1] * Math.exp(bracket[1]) > c)
      }, LAPS)
    })
  })

  describe('.brent()', () => {
    it('should return undefined if brackets are wrong', () => {
      utils.repeat(() => {
        const c = Math.random() * 10
        const sol = brent(
          t => t * Math.exp(t) - c,
          lambertW(c) + 1,
          lambertW(c) + 2
        )
        assert(typeof sol === 'undefined')
      }, LAPS)
    })
    it('should find the solution of exp(-x) = c x', () => {
      utils.repeat(() => {
        const c = Math.random() * 10
        const sol = brent(
          t => t * Math.exp(t) - c,
          lambertW(c) - 1,
          lambertW(c) + 1
        )
        assert(Math.abs((sol - lambertW(c)) / sol) < PRECISION)
      }, LAPS)
    })
  })

  describe('.newton()', () => {
    it('should find the solution of exp(-x) = c x', () => {
      utils.repeat(() => {
        const c = Math.random() * 10
        const sol = newton(
          t => t * Math.exp(t) - c,
          t => Math.exp(t) * (1 + t),
          Math.random() * 10
        )
        assert(Math.abs((sol - lambertW(c)) / sol) < PRECISION)
      }, LAPS)
    })
  })

  describe('.neumaier()', () => {
    it('should sum integers', () => {
      utils.repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)
        assert.equal(
          neumaier(Array.from({ length: n + 1 }, (d, i) => i)),
          n * (n + 1) / 2
        )
      }, LAPS)
    })

    it('should sum powers of 5', () => {
      utils.repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)

        const a = n * (n + 1) / 2
        assert.equal(
          neumaier(Array.from({ length: n + 1 }, (d, i) => i * i * i * i * i)),
          (4 * a * a * a - a * a) / 3
        )
      }, LAPS)
    })
  })
})
