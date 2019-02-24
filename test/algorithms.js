import { assert } from 'chai'
import { describe, it } from 'mocha'
import utils from './test-utils'
import lambertW from '../src/special/lambert-w'
import newton from '../src/algorithms/newton'
import neumaier from '../src/algorithms/neumaier'

const LAPS = 100
const EPS = 1e-6

describe('algorithms', () => {
  describe('.newton()', () => {
    it('should find the solution of exp(-x) = c x', () => {
      utils.repeat(() => {
        const c = Math.random() * 10
        const sol = newton(
          t => t * Math.exp(t) - c,
          t => Math.exp(t) * (1 + t),
          Math.random() * 10
        )
        assert(Math.abs((sol - lambertW(c)) / sol) < EPS)
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
