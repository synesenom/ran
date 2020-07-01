import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal } from './test-utils'
import { int } from '../src/core'
import * as dispersion from '../src/dispersion'

const SAMPLE_SIZE = 100

describe('dispersion', () => {
  describe('.variance()', () => {
    it('should compute the unbiased variance', () => {
      repeat(() => {
        const values = Array.from({length: int(2, SAMPLE_SIZE)}, Math.random)
        let mean = values.reduce((m, d) => d + m, 0) / values.length
        let stdev = values.reduce((v, d) => (d - mean) * (d - mean) + v, 0) / (values.length - 1)
        assert(equal(dispersion.variance(values), stdev))
      })
    })

    it('should return undefined if sample size is less than 2', () => {
      console.log(dispersion.variance([1, 2, 3, 4, 5]))
      assert(typeof dispersion.variance([]) === 'undefined')
      assert(typeof dispersion.variance([1]) === 'undefined')
    })
  })
})