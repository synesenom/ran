import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal } from './test-utils'
import * as shape from '../src/shape'

const SAMPLE_SIZE = 100

describe('dispersion', () => {
  describe('.skewness()', () => {
    it('should return undefined if sample size is less than 3', () => {
      assert(typeof shape.skewness([]) === 'undefined')
      assert(typeof shape.skewness([1]) === 'undefined')
      assert(typeof shape.skewness([1, 2]) === 'undefined')
    })

    it('should return undefined if mean is 0', () => {
      assert(typeof shape.skewness([1, 1, 1]) === 'undefined')
    })

    it('should return the coefficient of variation', () => {
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
        assert(equal(c * (x3 - 3 * x1 * s * s - x1 * x1 * x1) / (s * s * s), shape.skewness(values)))
      })
      console.log(shape.skewness([1, 2, 2, 2]))
    })
  })
})
