import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal, trials } from './test-utils'
import { int } from '../src/core'
import quantile from '../src/utils/quantile'

const SAMPLE_SIZE = 100

describe('.quantile()', () => {
  it('should return undefined for empty sample', () => {
    assert(typeof quantile([]) === 'undefined')
  })

  it('should return quantile for finite sample', () => {
    repeat(() => {
      const p = Math.random()
      const values = Array.from({length: SAMPLE_SIZE}, Math.random)
      const q = quantile(values, p)
      const h = (values.length - 1) * p
      const q0 = values.sort((a, b) => a - b)[Math.floor(h)]
      const q1 = values.sort((a, b) => a - b)[Math.floor(h) + 1]
      const qTest = q0 + (typeof q1 === 'undefined' ? 0 : (h - Math.floor(h)) * (q1 - q0))
      assert(equal(qTest, q))
    })
  })
})
