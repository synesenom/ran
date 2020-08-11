import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal } from './test-utils'
import { int } from '../src/core'
import * as shape from '../src/shape'
import * as dispersion from '../src/dispersion'

const SAMPLE_SIZE = 100

// TODO Go through methods and check input conditions.
describe('dispersion', () => {
  describe('.kurtosis()', () => {
    it('should return undefined if sample size is less than 3', () => {
      assert(typeof shape.kurtosis([]) === 'undefined')
      assert(typeof shape.kurtosis([1]) === 'undefined')
      assert(typeof shape.kurtosis([1, 2]) === 'undefined')
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

  describe('.moment()', () => {
    it('should return undefined for an empty sample', () => {
      assert(typeof shape.moment([]) === 'undefined')
    })

    it('should return the moment for finite sample for c = 0', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        const k = int(0, 10)
        let moment = shape.moment(values, k)
        let n = values.length
        let xk = 0
        for (let i = 0; i < values.length; i++) {
          xk += Math.pow(values[i], k)
        }
        xk /= n
        assert(equal(xk, moment))
      })
    })

    it('should return the moment for finite sample for c != 0', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        const k = int(0, 10)
        const c = Math.random()
        let moment = shape.moment(values, k, c)
        let n = values.length
        let xk = 0
        for (let i = 0; i < values.length; i++) {
          xk += Math.pow(values[i] - c, k)
        }
        xk /= n
        assert(equal(xk, moment))
      })
    })
  })

  describe('.odds()', () => {
    it('should return undefined if probability is 1', () => {
      assert(typeof shape.odds(1) === 'undefined')
    })

    it('should return the odds for a probability', () => {
      repeat(() => {
        const p = 0.01 + 0.99 * Math.random()
        assert(equal(shape.odds(p) === p / (1 - p)))
      })
    })
  })

  describe('.quantile()', () => {
    it('should return undefined for empty sample', () => {
      assert(typeof shape.quantile([], 0.5) === 'undefined')
    })

    it('should return quantile for finite sample', () => {
      repeat(() => {
        const p = Math.random()
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        const q = shape.quantile(values, p)
        const h = (values.length - 1) * p
        const q0 = values.sort((a, b) => a - b)[Math.floor(h)]
        const q1 = values.sort((a, b) => a - b)[Math.floor(h) + 1]
        const qTest = q0 + (typeof q1 === 'undefined' ? 0 : (h - Math.floor(h)) * (q1 - q0))
        assert(equal(qTest, q))
      })
    })
  })

  describe('.rank()', () => {
    it('should return undefined for an empty sample', () => {
      assert(typeof shape.rank([]) === 'undefined')
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

  describe('.yule()', () => {
    it('should return undefined for an empty sample', () => {
      assert(typeof shape.yule([]) === 'undefined')
    })

    it('should return undefined if lower and upper quartiles are the same', () => {
      assert(typeof shape.yule([1, 1, 1]) === 'undefined')
    })

    it(`should return Yule's coefficient for a finite sample`, () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        const yule = shape.yule(values)

        // Lower quartile.
        let h = (values.length - 1) * 0.25
        let q0 = values.sort((a, b) => a - b)[Math.floor(h)]
        let q1 = values.sort((a, b) => a - b)[Math.floor(h) + 1]
        const lo = q0 + (typeof q1 === 'undefined' ? 0 : (h - Math.floor(h)) * (q1 - q0))

        // Upper quartile.
        h = (values.length - 1) * 0.75
        q0 = values.sort((a, b) => a - b)[Math.floor(h)]
        q1 = values.sort((a, b) => a - b)[Math.floor(h) + 1]
        const hi = q0 + (typeof q1 === 'undefined' ? 0 : (h - Math.floor(h)) * (q1 - q0))

        // Median.
        const median = values.length % 2 === 0 ? 0.5 * (values[values.length / 2 - 1] + values[values.length / 2])
          : values[(values.length - 1) / 2]

        assert(equal((lo + hi - 2 * median) / (hi - lo), yule))
      })
    })
  })
})
