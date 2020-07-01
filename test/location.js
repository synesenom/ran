import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal } from './test-utils'
import { int } from '../src/core'
import * as location from '../src/location'

const SAMPLE_SIZE = 100

describe('location', () => {
  describe('.median()', () => {
    it('should compute the median for odd sample size', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE + 1}, Math.random)
          .sort((a, b) => a - b)
        let median = values[(values.length - 1) / 2]
        assert(location.median(values) === median)
      })
    })

    it('should compute the median for even sample size', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
          .sort((a, b) => a - b)
        let median = 0.5 * (values[values.length / 2 - 1] + values[values.length / 2])
        assert(equal(location.median(values), median))
      })
    })
  })
})