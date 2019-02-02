import { assert } from 'chai'
import { describe, it } from 'mocha'
import utils from './test-utils'
import { sum, neumaier, pairSum } from '../src/utils'

const LAPS = 100

describe('utils', () => {
  describe('.sum()', () => {
    it('should sum integers', () => {
      utils.repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)
        assert.equal(
          sum(Array.from({ length: n + 1 }, (d, i) => i)),
          n * (n + 1) / 2
        )
      }, LAPS)
    })

    it('should sum cubes', () => {
      utils.repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)

        const a = n * (n + 1) / 2
        assert.equal(
          sum(Array.from({ length: n + 1 }, (d, i) => i), 3),
          a * a
        )
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
