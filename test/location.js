import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal, trials } from './test-utils'
import { int } from '../src/core'
import * as location from '../src/location'
import * as dist from '../src/dist'

const SAMPLE_SIZE = 100

describe('location', () => {
  describe('.geometricMean()', () => {
    it('should return zero for sample containing zero', () => {
      repeat(() => {
        const values = Array.from({ length: SAMPLE_SIZE}, Math.random)
          .concat([0])
        assert(location.geometricMean(values) === 0)
      })
    })

    it('should return the geometric mean of the sample', () => {
      repeat(() => {
        const values = Array.from({ length: SAMPLE_SIZE}, Math.random)
        let mean = Math.pow(values.reduce((prod, d) => d * prod, 1), 1 / SAMPLE_SIZE)
        assert(equal(location.geometricMean(values), mean))
      })
    })
  })

  describe('.harmonicMean()', () => {
    it('should return undefined for sample containing zero', () => {
      repeat(() => {
        const values = Array.from({ length: SAMPLE_SIZE}, Math.random)
          .concat([0])
        assert(typeof location.harmonicMean(values) === 'undefined')
      })
    })

    it('should return undefined for sample containing negative values', () => {
      repeat(() => {
        const values = Array.from({ length: SAMPLE_SIZE}, Math.random)
          .concat([-1])
        assert(typeof location.harmonicMean(values) === 'undefined')
      })
    })

    it('should return the geometric mean of the sample', () => {
      repeat(() => {
        const values = Array.from({ length: SAMPLE_SIZE}, Math.random)
        let mean = values.length / values.reduce((sum, d) => sum + 1 / d, 0)
        assert(equal(location.harmonicMean(values), mean))
      })
    })
  })

  describe('.median()', () => {
    it('should return undefined for a sample size less than 1', () => {
      assert(typeof location.median([]) === 'undefined')
    })

    it('should return the median for odd sample size', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE + 1}, Math.random)
          .sort((a, b) => a - b)
        let median = values[(values.length - 1) / 2]
        assert(location.median(values) === median)
      })
    })

    it('should return the median for even sample size', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
          .sort((a, b) => a - b)
        let median = 0.5 * (values[values.length / 2 - 1] + values[values.length / 2])
        assert(equal(location.median(values), median))
      })
    })
  })

  describe('.mode()', () => {
    it('should return undefined for a sample size less than 1', () => {
      assert(typeof location.mode([]) === 'undefined')
    })

    describe('discrete sample', () => {
      it('should return an array of a single element for unimodal sample', () => {
        const values = Array.from({length: SAMPLE_SIZE}, () => int(20))
          .concat(new Array(SAMPLE_SIZE).fill(21))
        const mode = location.mode(values)
        assert(mode.length === 1)
        assert(equal(mode[0], 21))
      })

      it('should return an array of a multiple elements for multimodal sample', () => {
        const values = Array.from({length: SAMPLE_SIZE}, () => int(20))
          .concat(new Array(SAMPLE_SIZE).fill(21))
          .concat(new Array(SAMPLE_SIZE).fill(22))
        const mode = location.mode(values)
        assert(mode.length === 2, 'Number of modes is invalid')
        console.log(mode)
        assert(equal(mode[0], 21), 'Value of first mode is invalid')
        assert(equal(mode[1], 22), 'Value of second mode is invalid')
      })
    })

    describe('continuous sample', () => {
      it('should return the single element for sample size 1', () => {
        assert(location.mode([1.2]) === 1.2)
      })

      it('should return the mean of elements for sample size 2', () => {
        assert(equal(location.mode([1.2, 2.2]), 1.7))
      })

      it('should return the mean of the closest pairs or the mid point for sample size 3', () => {
        assert(equal(location.mode([1.5, 2, 2.5]), 2))
        assert(equal(location.mode([1, 2, 4.1]), 1.5))
        assert(equal(location.mode([1.1, 3, 4]), 3.5))
      })

      it('should return the approximate mode for sample size larger than 3', () => {
        trials(() => {
          const mu = 10 * Math.random()
          const sample = new dist.Normal(mu, 0.1).sample(1000)
          const mode = location.mode(sample)
          return equal(mode, mu, 2)
        })
      })
    })
  })
})
