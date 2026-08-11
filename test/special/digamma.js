import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.digamma', () => {
  const EM = 0.5772156649015329

  describe('digamma(z)', () => {
    it('should return reference values', () => {
      assert(equal(special.digamma(1), -EM))
      assert(equal(special.digamma(2), 1 - EM))
      assert(equal(special.digamma(0.5), -EM - 2 * Math.log(2)))
      assert(equal(special.digamma(0.25), -Math.PI / 2 - 3 * Math.log(2) - EM))
      // z >= 10: direct Stirling path
      assert(equal(special.digamma(10), 2.251752589066721))
    })

    it('should return reference values for negative non-integer arguments', () => {
      // Exercises the reflection formula: ψ(z) = ψ(1-z) - π·cot(πz)
      // ψ(-0.5) = ψ(1.5) = ψ(0.5) + 2 = 2 - EM - 2·ln2
      assert(equal(special.digamma(-0.5), 2 - EM - 2 * Math.log(2)))
      // ψ(-1.5) = ψ(2.5) = ψ(1.5) + 2/3
      assert(equal(special.digamma(-1.5), 2 - EM - 2 * Math.log(2) + 2 / 3))
      // mpmath mp.dps=50: mp.digamma(-2.5)
      assert(equal(special.digamma(-2.5), 1.103156640645243, 14))
    })

    it('should return Infinity at the non-positive integer poles', () => {
      // ADR-0015: divergence returns Infinity specifically (not NaN, not a huge finite).
      assert.strictEqual(special.digamma(0), Infinity)
      assert.strictEqual(special.digamma(-1), Infinity)
      assert.strictEqual(special.digamma(-2), Infinity)
    })

    it('should stay full-precision within 1e-6 of a negative integer pole', () => {
      // mpmath mp.dps=60 evaluated at the exact double of (-1+1e-7) / (-2+1e-7): the input
      // itself only pins the offset to ~1e-9, but the dominant pole term -1/(z+n) is otherwise
      // carried at machine precision (no argument-reduction loss in cot(πz)).
      assert(equal(special.digamma(-1 + 1e-7), -9999999.582479, 13))
      assert(equal(special.digamma(-2 + 1e-7), -9999999.071376376, 13))
    })

    it('should satisfy the recurrence ψ(z+1) = ψ(z) + 1/z', () => {
      for (const z of [0.1, 0.5, 1, 6, 100]) {
        assert(equal(special.digamma(z + 1), special.digamma(z) + 1 / z))
      }
    })
  })
})
