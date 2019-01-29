import assert from 'assert'
import { describe, it } from 'mocha'
import utils from './test-utils'
import { sum } from '../src/utils'

const LAPS = 100

describe('utils', () => {
  describe('.sum()', () => {
    it('should sum integers', () => {
      utils.repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)
        assert(
          sum(Array.from({ length: n }, (d, i) => i)),
          n * (n + 1) / 2
        )
      }, LAPS)
    })

    it('should sum cubes', () => {
      utils.repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)

        const a = n * (n + 1) / 2
        assert(
          sum(Array.from({ length: n }, (d, i) => i), 3),
          a * a
        )
      }, LAPS)
    })
  })

  describe('.neumaier()', () => {
    it('should sum integers', () => {
      utils.repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)
        assert(
          sum(Array.from({ length: n }, (d, i) => i)),
          n * (n + 1) / 2
        )
      }, LAPS)
    })

    it('should sum powers of 5', () => {
      utils.repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)

        const a = n * (n + 1) / 2
        assert(
          sum(Array.from({ length: n }, (d, i) => i), 5),
          (4 * a * a * a - a * a) / 3
        )
      }, LAPS)
    })
  })
})
