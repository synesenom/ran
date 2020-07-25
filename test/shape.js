import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal } from './test-utils'
import { int } from '../src/core'
import * as shape from '../src/shape'
import * as dispersion from '../src/dispersion'

const SAMPLE_SIZE = 100

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
