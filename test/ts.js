import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as ts from '../src/ts'

describe('ts', () => {
  describe('.OnlineCovariance', () => {
    it('should default to dimension 1', () => {
      const oc = new ts.OnlineCovariance()
      oc.update([5])
      const m = oc.compute().m()
      assert.strictEqual(m[0][0], 0)
    })

    describe('.compute()', () => {
      it('should return a NaN-filled matrix when no updates have been made', () => {
        const oc = new ts.OnlineCovariance(2)
        const m = oc.compute().m()
        assert(Number.isNaN(m[0][0]))
        assert(Number.isNaN(m[0][1]))
        assert(Number.isNaN(m[1][0]))
        assert(Number.isNaN(m[1][1]))
      })

      it('should return the covariance matrix after updates', () => {
        const oc = new ts.OnlineCovariance(1)
        oc.update([1])
        oc.update([2])
        oc.update([3])
        const m = oc.compute().m()
        // Population covariance: sum of squared deviations / n = 2/3
        assert(Math.abs(m[0][0] - 2 / 3) < 1e-10)
      })
    })
  })
})
