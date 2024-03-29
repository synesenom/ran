import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat } from './test-utils'
import { lambertW0 } from '../src/special/lambert-w'
import * as algorithms from '../src/algorithms'
import { int, shuffle } from '../src/core'

const LAPS = 100
const PRECISION = 1e-10

describe('algorithms', () => {
  describe('.bracket()', () => {
    it('should return undefined if initial bracket is invalid', () => {
      repeat(() => {
        const c = Math.random() * 10
        const bracket = algorithms.bracket(
          t => t * Math.exp(t) - c,
          lambertW0(c) + 1,
          lambertW0(c) + 1
        )
        assert(typeof bracket === 'undefined')
      }, LAPS)
    })

    it('should find an appropriate bracket for exp(-x) = c x', () => {
      repeat(() => {
        const c = Math.random() * 10
        const bracket = algorithms.bracket(
          t => t * Math.exp(t) - c,
          lambertW0(c) + 1,
          lambertW0(c) + 2
        )
        assert(bracket[0] * Math.exp(bracket[0]) < c && bracket[1] * Math.exp(bracket[1]) > c)
      }, LAPS)
    })

    it('should return the specified boundaries if root was not found', () => {
      const bracket = algorithms.bracket(
        t => Math.exp(-t) + 1,
        0,
        2
      )
      assert(bracket[0] === 0 && bracket[1] === 2)
    })
  })

  describe('.brent()', () => {
    it('should return undefined if brackets are wrong', () => {
      const c = 5
      const sol = algorithms.brent(
        t => t * Math.exp(t) - c,
        lambertW0(c) + 1,
        lambertW0(c) + 2
      )
      assert(typeof sol === 'undefined')
    })
    it('should find the solution of exp(-x) = c x', () => {
      repeat(() => {
        const c = Math.random() * 10
        const sol = algorithms.brent(
          t => t * Math.exp(t) - c,
          lambertW0(c) - 1,
          lambertW0(c) + 1
        )
        assert(Math.abs((sol - lambertW0(c)) / sol) < PRECISION)
      }, LAPS)
    })
  })

  describe('.newton()', () => {
    it('should find the solution of exp(-x) = c x', () => {
      repeat(() => {
        const c = Math.random() * 10
        const sol = algorithms.newton(
          t => t * Math.exp(t) - c,
          t => Math.exp(t) * (1 + t),
          Math.random() * 10
        )
        assert(Math.abs((sol - lambertW0(c)) / sol) < PRECISION)
      }, LAPS)
    })

    it('should find the solution of exp(x) - 1 = x', () => {
      repeat(() => {
        const sol = algorithms.newton(
          t => Math.exp(t) - t - 1,
          t => Math.exp(t) - 1,
          0
        )
        assert(Math.abs(sol) < PRECISION)
      })
    })
  })

  describe('.neumaier()', () => {
    it('should sum integers', () => {
      repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)
        assert.equal(
          algorithms.neumaier(Array.from({ length: n + 1 }, (d, i) => i)),
          n * (n + 1) / 2
        )
      }, LAPS)
    })

    it('should sum powers of 5', () => {
      repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)

        const a = n * (n + 1) / 2
        assert.equal(
          algorithms.neumaier(Array.from({ length: n + 1 }, (d, i) => i * i * i * i * i)),
          (4 * a * a * a - a * a) / 3
        )
      }, LAPS)
    })
  })

  describe('romberg()', () => {
    it('should integrate the function x^3 exp(-x)', () => {
      const integral = t => Math.exp(-t) * (-t * (t * (t + 3) + 6) - 6) + 6
      for (let b = 0.1; b < 10; b++) {
        const i = algorithms.romberg(
          t => Math.pow(t, 3) * Math.exp(-t),
          0,
          b
        )
        assert(Math.abs((i - integral(b)) / i) < PRECISION)
      }
    })
  })

  describe('.quickselect()', () => {
    it('should select the k-th element', () => {
      repeat(() => {
        const values = Array.from({ length: 100 }, Math.random)
        const k = int(50, 99)
        const item = values.sort((a, b) => a - b)[k]
        assert(algorithms.quickselect(shuffle(values), k) === item)
      }, LAPS)
    })
  })
})
