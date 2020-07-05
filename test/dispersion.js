import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal } from './test-utils'
import * as dispersion from '../src/dispersion'

const SAMPLE_SIZE = 100

describe('dispersion', () => {
  describe('.variance()', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.variance([]) === 'undefined')
      assert(typeof dispersion.variance([1]) === 'undefined')
    })

    it('should return the unbiased variance', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = values.reduce((m, d) => d + m, 0) / values.length
        let variance = values.reduce((v, d) => (d - mean) * (d - mean) + v, 0) / (values.length - 1)
        assert(equal(dispersion.variance(values), variance))
      })
    })
  })

  describe('.stdev()', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.stdev([]) === 'undefined')
      assert(typeof dispersion.stdev([1]) === 'undefined')
    })

    it('should return the unbiased standard deviation', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = values.reduce((m, d) => d + m, 0) / values.length
        let stdev = Math.sqrt(values.reduce((v, d) => (d - mean) * (d - mean) + v, 0) / (values.length - 1))
        assert(equal(dispersion.stdev(values), stdev))
      })
    })
  })

  describe('.cv', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.cv([]) === 'undefined')
      assert(typeof dispersion.cv([1]) === 'undefined')
    })

    it('should return undefined if mean is 0', () => {
      assert(typeof dispersion.cv([-1, 0, 1]) === 'undefined')
    })

    it('should return the coefficient of variation', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = values.reduce((m, d) => d + m, 0) / values.length
        let stdev = Math.sqrt(values.reduce((v, d) => (d - mean) * (d - mean) + v, 0) / (values.length - 1))
        assert(equal(dispersion.cv(values), stdev / mean))
      })
      console.log(dispersion.cv([1, 2, 3, 4, 5]))
    })
  })

  describe('.md', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.md([]) === 'undefined')
      assert(typeof dispersion.md([1]) === 'undefined')
    })

    it('should return the mean absolute difference', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let md = 0
        for (let i = 0; i < values.length; i++) {
          for (let j = 0; j < values.length; j++) {
            md += Math.abs(values[i] - values[j])
          }
        }
        md /= values.length * values.length
        assert(equal(dispersion.md(values), md))
      })
    })
  })

  describe('.rmd', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.rmd([]) === 'undefined')
      assert(typeof dispersion.rmd([1]) === 'undefined')
    })

    it('should return undefined if mean is zero', () => {
      assert(typeof dispersion.rmd([-1, 0, 1]) === 'undefined')
    })

    it('should return the relative mean absolute difference', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = 0
        let rd = 0
        for (let i = 0; i < values.length; i++) {
          mean += values[i]
          for (let j = 0; j < values.length; j++) {
            rd += Math.abs(values[i] - values[j])
          }
        }
        mean /= values.length
        rd /= mean * values.length * values.length
        assert(equal(dispersion.rmd(values), rd))
      })
    })
  })
})
