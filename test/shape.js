import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal } from './test-utils'
import * as shape from '../src/shape'

const SAMPLE_SIZE = 100

describe('dispersion', () => {
  describe('.kurtosis()', () => {
    it('should return undefined if sample size is less than 3', () => {
      assert(typeof shape.kurtosis([]) === 'undefined')
      assert(typeof shape.kurtosis([1]) === 'undefined')
      assert(typeof shape.kurtosis([1, 2]) === 'undefined')

      console.log(shape.kurtosis([1, 2, 2, 2, 1]))
    })

    it('should return undefined if the variance is 0', () => {
      assert(typeof shape.kurtosis([1, 1, 1]) === 'undefined')
    })

    it('should return the kurtosis', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let kurtosis = shape.kurtosis(values)
        let n = values.length
        let x1 = 0
        for (let i = 0; i < values.length; i++) {
          x1 += values[i]
        }
        x1 /= n

        let x2 = 0
        let x4 = 0
        for (let i = 0; i < values.length; i++) {
          x2 += Math.pow(values[i] - x1, 2)
          x4 += Math.pow(values[i] - x1, 4)
        }
        assert(equal((n + 1) * n * (n - 1) * x4 / (x2 * x2 * (n - 2) * (n - 3)) - 3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3)), kurtosis))
      })
    })
  })

  describe('.skewness()', () => {
    it('should return undefined if sample size is less than 3', () => {
      assert(typeof shape.skewness([]) === 'undefined')
      assert(typeof shape.skewness([1]) === 'undefined')
      assert(typeof shape.skewness([1, 2]) === 'undefined')
    })

    it('should return undefined if the variance is 0', () => {
      assert(typeof shape.skewness([1, 1, 1]) === 'undefined')
    })

    it('should return the skewness', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let skewness = shape.skewness(values)
        let n = values.length
        let x1 = 0
        let x2 = 0
        let x3 = 0
        for (let i = 0; i < values.length; i++) {
          x1 += values[i]
          x2 += values[i] * values[i]
          x3 += Math.pow(values[i], 3)
        }
        x1 /= n
        x2 /= n
        x3 /= n
        let s = Math.sqrt(Math.abs(x2 - x1 * x1))
        let c = Math.sqrt(n * (n - 1)) / (n - 2)
        assert(equal(c * (x3 - 3 * x1 * s * s - x1 * x1 * x1) / (s * s * s), skewness))
      })
    })
  })
})
