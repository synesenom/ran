import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from './test-utils'
import { int } from '../src/core'
import * as location from '../src/location'
import * as dist from '../src/dist'

const SAMPLE_SIZE = 100

describe('location', () => {
  describe('.mean()', () => {
    it('should return NaN for an empty sample', () => {
      assert(Number.isNaN(location.mean([])))
    })

    it('should return the mean of the sample', () => {
      // (1+2+3)/3 = 2
      assert(equal(location.mean([1, 2, 3]), 2))
      // (2+4+6+8)/4 = 5
      assert(equal(location.mean([2, 4, 6, 8]), 5))
    })

    it('should return the single element for a one-element sample', () => {
      assert(equal(location.mean([7]), 7))
    })

    it('should return the element itself for all-identical values', () => {
      assert(equal(location.mean([3, 3, 3]), 3))
    })

    it('should return the midpoint for a two-element sample', () => {
      // (1+3)/2 = 2
      assert(equal(location.mean([1, 3]), 2))
    })
  })

  describe('.geometricMean()', () => {
    it('should return zero for sample containing zero', () => {
      assert(location.geometricMean([1, 2, 0, 3]) === 0)
      assert(location.geometricMean([0]) === 0)
    })

    it('should return the geometric mean of the sample', () => {
      // (1·2·3)^(1/3) = 6^(1/3)
      assert(equal(location.geometricMean([1, 2, 3]), Math.pow(6, 1 / 3)))
      // (1·4·9)^(1/3) = 36^(1/3)
      assert(equal(location.geometricMean([1, 4, 9]), Math.pow(36, 1 / 3)))
    })

    it('should return the single element for a one-element sample', () => {
      assert(equal(location.geometricMean([5]), 5))
    })

    it('should return the element itself for all-identical values', () => {
      assert(equal(location.geometricMean([3, 3, 3]), 3))
    })

    it('should return the geometric mean for a two-element sample', () => {
      // sqrt(2·8) = sqrt(16) = 4
      assert(equal(location.geometricMean([2, 8]), 4))
    })
  })

  describe('.harmonicMean()', () => {
    it('should return NaN for sample containing zero', () => {
      assert(Number.isNaN(location.harmonicMean([1, 2, 0, 3])))
      assert(Number.isNaN(location.harmonicMean([0])))
    })

    it('should return NaN for sample containing negative values', () => {
      assert(Number.isNaN(location.harmonicMean([1, 2, -1])))
      assert(Number.isNaN(location.harmonicMean([-1])))
    })

    it('should return the harmonic mean of the sample', () => {
      // 3/(1+1/2+1/3) = 3/(11/6) = 18/11
      assert(equal(location.harmonicMean([1, 2, 3]), 18 / 11))
      // 3/(1/2+1/3+1/6) = 3/1 = 3
      assert(equal(location.harmonicMean([2, 3, 6]), 3))
    })

    it('should return the element itself for all-identical values', () => {
      assert(equal(location.harmonicMean([5, 5, 5]), 5))
    })

    it('should return the harmonic mean for a two-element sample', () => {
      // 2/(1/2+1/6) = 2/(2/3) = 3
      assert(equal(location.harmonicMean([2, 6]), 3))
    })
  })

  describe('.median()', () => {
    it('should return NaN for an empty sample', () => {
      assert(Number.isNaN(location.median([])))
    })

    it('should return the median for odd sample size', () => {
      // sorted [1,2,3] → middle = 2
      assert(equal(location.median([3, 1, 2]), 2))
      // sorted [1,2,3,4,5] → middle = 3
      assert(equal(location.median([5, 1, 3, 2, 4]), 3))
    })

    it('should return the median for even sample size', () => {
      // sorted [1,2,3,4] → (2+3)/2 = 2.5
      assert(equal(location.median([1, 2, 3, 4]), 2.5))
      // sorted [1,2] → (1+2)/2 = 1.5
      assert(equal(location.median([1, 2]), 1.5))
    })

    it('should return the single element for a one-element sample', () => {
      assert(equal(location.median([7]), 7))
    })

    it('should return the element itself for all-identical values', () => {
      assert(equal(location.median([4, 4, 4]), 4))
    })
  })

  describe('.midrange()', () => {
    it('should return NaN for an empty sample', () => {
      assert(Number.isNaN(location.midrange([])))
    })

    it('should return the midrange for a finite sample', () => {
      // min=1, max=5 → (1+5)/2 = 3
      assert(equal(location.midrange([3, 1, 5, 2, 4]), 3))
      // min=0, max=2 → (0+2)/2 = 1
      assert(equal(location.midrange([0, 0, 2]), 1))
    })

    it('should return the element itself for all-identical values', () => {
      assert(equal(location.midrange([6, 6, 6]), 6))
    })

    it('should return the midpoint for a two-element sample', () => {
      // (1+3)/2 = 2
      assert(equal(location.midrange([1, 3]), 2))
    })
  })

  describe('.mode()', () => {
    it('should return empty array for an empty sample', () => {
      assert.deepEqual(location.mode([]), [])
    })

    describe('discrete sample', () => {
      it('should return an array of a single element for unimodal sample', () => {
        const values = Array.from({ length: SAMPLE_SIZE }, () => int(20))
          .concat(new Array(SAMPLE_SIZE).fill(21))
        const mode = location.mode(values)
        assert(mode.length === 1)
        assert(equal(mode[0], 21))
      })

      it('should return an array of a multiple elements for multimodal sample', () => {
        const values = Array.from({ length: SAMPLE_SIZE }, () => int(20))
          .concat(new Array(SAMPLE_SIZE).fill(21))
          .concat(new Array(SAMPLE_SIZE).fill(22))
        const mode = location.mode(values)
        assert(mode.length === 2, 'Number of modes is invalid')
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
        const mu = 3.7
        const sample = new dist.Normal(mu, 0.1).seed(0).sample(1000)
        const mode = location.mode(sample)
        assert(equal(mode, mu, 2))
      })
    })
  })

  describe('.trimean()', () => {
    it('should return NaN for an empty sample', () => {
      assert(Number.isNaN(location.trimean([])))
    })

    it('should return the trimean for a finite sample', () => {
      // Q1=1.5, Q2=2, Q3=2.5 → (1.5+2·2+2.5)/4 = 2
      assert(equal(location.trimean([1, 2, 3]), 2))
      // Q1=1.75, Q2=2.5, Q3=3.25 → (1.75+2·2.5+3.25)/4 = 2.5
      assert(equal(location.trimean([1, 2, 3, 4]), 2.5))
      // asymmetric: Q1=1.75, Q2=3.5, Q3=6.25 → (1.75+2·3.5+6.25)/4 = 3.75 ≠ median
      assert(equal(location.trimean([1, 2, 5, 10]), 3.75))
    })

    it('should return the element itself for all-identical values', () => {
      assert(equal(location.trimean([2, 2, 2]), 2))
    })

    it('should return the midpoint for a two-element sample', () => {
      // Q1=1.25, Q2=1.5, Q3=1.75 → (1.25+2·1.5+1.75)/4 = 1.5
      assert(equal(location.trimean([1, 2]), 1.5))
    })
  })
})
