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

    it('should compute the unbiased variance', () => {
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

    it('should compute the unbiased standard deviation', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = values.reduce((m, d) => d + m, 0) / values.length
        let stdev = Math.sqrt(values.reduce((v, d) => (d - mean) * (d - mean) + v, 0) / (values.length - 1))
        assert(equal(dispersion.stdev(values), stdev))
      })
    })
  })

  describe('.md', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.md([]) === 'undefined')
      assert(typeof dispersion.md([1]) === 'undefined')
    })

    it('should compute the mean absolute difference', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let md = 0
        for (let i = 0; i < values.length; i++) {
          for (let j = 0; j < values.length; j++) {
            md += Math.abs(values[i] - values[j])
          }
        }
        md /= (values.length * values.length)
        assert(equal(dispersion.md(values), md))
      })
    })
  })
})
