import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from './test-utils'
import * as shape from '../src/shape'

describe('shape', () => {
  describe('.kurtosis()', () => {
    it('should return NaN if sample size is less than 3', () => {
      assert(Number.isNaN(shape.kurtosis([])))
      assert(Number.isNaN(shape.kurtosis([1])))
      assert(Number.isNaN(shape.kurtosis([1, 2])))
    })

    it('should return NaN if the variance is 0', () => {
      assert(Number.isNaN(shape.kurtosis([1, 1, 1])))
    })

    it('should return the kurtosis', () => {
      // [1, 2, 3, 4, 5]: symmetric, m2=2, m4=6.8, kurtosis=-1.2
      assert(equal(shape.kurtosis([1, 2, 3, 4, 5]), -1.2))
      // [2, 4, 4, 4, 5, 5, 7, 9]: mean=5, m2=4, m4=44.5, kurtosis=0.940625
      assert(equal(shape.kurtosis([2, 4, 4, 4, 5, 5, 7, 9]), 0.940625))
    })
  })

  describe('.moment()', () => {
    it('should return NaN for an empty sample', () => {
      assert(Number.isNaN(shape.moment([], 2)))
    })

    it('should return the moment for finite sample for c = 0', () => {
      // k=0: x^0=1 for all x, so moment=1
      assert(equal(shape.moment([1, 2, 3], 0), 1))
      // k=1: moment([1,2,3], 1) = mean = 2
      assert(equal(shape.moment([1, 2, 3], 1), 2))
      // k=2: moment([1,2,3], 2) = (1+4+9)/3 = 14/3
      assert(equal(shape.moment([1, 2, 3], 2), 14 / 3))
      // k=2: moment([1,2,3,4,5], 2) = (1+4+9+16+25)/5 = 11
      assert(equal(shape.moment([1, 2, 3, 4, 5], 2), 11))
    })

    it('should return the moment for finite sample for c != 0', () => {
      // moment([1,2,3], 1, 2) = mean([-1,0,1]) = 0
      assert(equal(shape.moment([1, 2, 3], 1, 2), 0))
      // moment([1,2,3,4,5], 2, 3) = mean([4,1,0,1,4]) = 2
      assert(equal(shape.moment([1, 2, 3, 4, 5], 2, 3), 2))
      // moment([2,4,6], 3, 4) = mean([-8,0,8]) = 0
      assert(equal(shape.moment([2, 4, 6], 3, 4), 0))
    })
  })

  describe('.quantile()', () => {
    it('should return NaN for empty sample', () => {
      assert(Number.isNaN(shape.quantile([], 0.5)))
    })

    it('should return quantile for finite sample', () => {
      // Evenly-spaced [1..5]: quartile points land on exact integers
      assert(equal(shape.quantile([1, 2, 3, 4, 5], 0), 1))
      assert(equal(shape.quantile([1, 2, 3, 4, 5], 0.25), 2))
      assert(equal(shape.quantile([1, 2, 3, 4, 5], 0.5), 3))
      assert(equal(shape.quantile([1, 2, 3, 4, 5], 0.75), 4))
      assert(equal(shape.quantile([1, 2, 3, 4, 5], 1), 5))
      // Interpolation: h=2.25, Q=30+0.25*(40-30)=32.5
      assert(equal(shape.quantile([10, 20, 30, 40], 0.75), 32.5))
    })
  })

  describe('.rank()', () => {
    it('should return empty array for an empty sample', () => {
      assert.deepEqual(shape.rank([]), [])
    })

    it('.should rank values using fractional rank', () => {
      // Test case input and expected output.
      const values = [
        33, 6, 29, 5, 14, 31, 19, 28, 46, 47, 11, 26, 16, 18, 39, 9, 10, 0, 35, 46, 25, 0, 28, 28, 34, 11, 22, 49, 26,
        14, 15, 13, 43, 35, 26, 40, 9, 49, 13, 9, 24, 47, 9, 23, 18, 4, 27, 33, 0, 11, 41, 39, 7, 28, 0, 23, 20, 15, 24,
        4, 14, 31, 18, 28, 0, 24, 39, 34, 14, 15, 37, 9, 7, 1, 9, 17, 13, 8, 35, 20, 31, 17, 5, 4, 2, 42, 42, 7, 20, 48,
        17, 31, 42, 34, 37, 35, 43, 9, 39, 8]
      const ranks = [
        72.5, 13, 67, 11.5, 34.5, 69.5, 47, 64, 94.5, 96.5, 28, 59, 40, 45, 84.5, 22, 26, 3, 78.5, 94.5, 57, 3, 64, 64,
        75, 28, 51, 99.5, 59, 34.5, 38, 31, 92.5, 78.5, 59, 87, 22, 99.5, 31, 22, 55, 96.5, 22, 52.5, 45, 9, 61, 72.5,
        3, 28, 88, 84.5, 15, 64, 3, 52.5, 49, 38, 55, 9, 34.5, 69.5, 45, 64, 3, 55, 84.5, 75, 34.5, 38, 81.5, 22, 15, 6,
        22, 42, 31, 17.5, 78.5, 49, 69.5, 42, 11.5, 9, 7, 90, 90, 15, 49, 98, 42, 69.5, 90, 75, 81.5, 78.5, 92.5, 22,
        84.5, 17.5]
      assert(shape.rank(values).reduce((acc, d, i) => acc && d === ranks[i], true))
    })
  })

  describe('.skewness()', () => {
    it('should return NaN if sample size is less than 3', () => {
      assert(Number.isNaN(shape.skewness([])))
      assert(Number.isNaN(shape.skewness([1])))
      assert(Number.isNaN(shape.skewness([1, 2])))
    })

    it('should return NaN if the variance is 0', () => {
      assert(Number.isNaN(shape.skewness([1, 1, 1])))
    })

    it('should return the skewness', () => {
      // [1, 2, 3, 4, 5]: symmetric, m3=0, skewness=0
      assert(equal(shape.skewness([1, 2, 3, 4, 5]), 0))
      // [1, 1, 1, 2]: positive skew = 2 (from docstring)
      assert(equal(shape.skewness([1, 1, 1, 2]), 2))
      // [1, 2, 2, 2]: negative skew = -2 (from docstring)
      assert(equal(shape.skewness([1, 2, 2, 2]), -2))
    })
  })

  describe('.yule()', () => {
    it('should return NaN for an empty sample', () => {
      assert(Number.isNaN(shape.yule([])))
    })

    it('should return NaN if lower and upper quartiles are the same', () => {
      assert(Number.isNaN(shape.yule([1, 1, 1])))
    })

    it('should return Yule\'s coefficient for a finite sample', () => {
      // [1, 2, 3, 4, 5]: Q1=2, Q3=4, median=3, yule=(2+4-6)/(4-2)=0
      assert(equal(shape.yule([1, 2, 3, 4, 5]), 0))
      // [1, 1, 2, 4, 8]: Q1=1, Q3=4, median=2, yule=(1+4-4)/(4-1)=1/3
      assert(equal(shape.yule([1, 1, 2, 4, 8]), 1 / 3))
    })
  })
})
