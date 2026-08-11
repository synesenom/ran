import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.betaIncomplete', () => {
  describe('.betaIncomplete()', () => {
    it('B(a, b, x) should be equal to 0 if b > 0 and x <= 0', () => {
      for (const a of [0.5, 1, 2]) {
        for (const b of [1, 2]) {
          assert(special.betaIncomplete(a, b, -1) === 0)
        }
      }
    })

    it('B(a, b, x) should be equal to B(a,b) if b > 0 and x >= 1', () => {
      for (const a of [0.5, 1, 2]) {
        for (const b of [1, 2]) {
          const expected = Math.exp(special.logGamma(a) + special.logGamma(b) - special.logGamma(a + b))
          assert(special.betaIncomplete(a, b, 2) === expected)
        }
      }
    })

    it('should return mpmath reference values near x=0 with mismatched a/b ratios', () => {
      // Forward branch (x < (a+1)/(a+b+2)); precision probe at extreme small-x / high-b cases
      // mpmath mp.dps=50: betainc(a, b, 0, x)
      assert(equal(special.betaIncomplete(0.1, 10, 0.001), 5.007780291668116, 14))
      assert(equal(special.betaIncomplete(0.01, 100, 0.0001), 91.19216638673353, 14))
    })

    it('should return mpmath reference values near x=1 with mismatched a/b ratios', () => {
      // Backward branch (x > (a+1)/(a+b+2)); uses complement B(a,b) - B(b,a,1-x)
      // mpmath mp.dps=50: betainc(a, b, 0, x)
      // Full precision (14 digits): moderate a/b ratio, x not at extreme boundary
      assert(equal(special.betaIncomplete(10, 0.5, 0.999), 0.5044901143493632, 14))
      // Reduced precision (13 digits): a/b=100:1, mild boundary
      assert(equal(special.betaIncomplete(10, 0.1, 0.95), 0.45383747791410134, 13))
      // Reduced precision (11 digits): a/b=10000:1, x very close to 1 — complement B(a,b)-B(b,a,1-x)
      // loses ~2 digits from catastrophic cancellation; inherent to the algorithm at this regime
      assert(equal(special.betaIncomplete(100, 0.01, 0.9999), 3.7699233945564345, 11))
    })

    it('should return mpmath reference values at comfortable interior points', () => {
      // mpmath mp.dps=50: betainc(a, b, 0, x)
      assert(equal(special.betaIncomplete(2, 3, 0.4), 0.04373333333333334, 14))
      assert(equal(special.betaIncomplete(5, 5, 0.5), 0.0007936507936507937, 14))
    })

    it('should return mpmath reference values for large a/b parameters', () => {
      // mpmath mp.dps=50: betainc(a, b, 0, x); result is very small due to large shape params
      assert(equal(special.betaIncomplete(50, 50, 0.5), 1.982330604283668e-31, 13))
      // B(100,1,x) = x^100/100 analytically; at x=0.1 this is exactly 1e-102
      assert(equal(special.betaIncomplete(100, 1, 0.1), 1e-102, 13))
    })
  })
})
