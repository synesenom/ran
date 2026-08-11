import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.beta', () => {
  describe('.beta()', () => {
    it('should return exact values for small positive integer arguments', () => {
      // B(1,1) = 1 exactly
      assert.strictEqual(special.beta(1, 1), 1)
      // B(1,4) = 1/4 = 0.25 exactly — the YuleSimon quantile bug case
      assert.strictEqual(special.beta(1, 4), 0.25)
      // Symmetry: B(4,1) must equal B(1,4)
      assert.strictEqual(special.beta(4, 1), 0.25)
      // B(2,3) = 1/12; not exactly representable but must be closest double
      assert(Math.abs(special.beta(2, 3) - 1 / 12) <= Number.EPSILON * (1 / 12))
      // B(3,3) = 1/30; same criterion
      assert(Math.abs(special.beta(3, 3) - 1 / 30) <= Number.EPSILON * (1 / 30))
      // B(3,5) = 2!·4!/7! = 1/105; verify correct value and symmetry
      assert(Math.abs(special.beta(3, 5) - 1 / 105) <= 2 * Number.EPSILON * (1 / 105))
      assert(special.beta(5, 3) === special.beta(3, 5))
    })

    it('should agree with the logGamma path for non-integer arguments', () => {
      // B(0.5, 0.5) = pi; non-integer path unchanged
      assert(equal(special.beta(0.5, 0.5), Math.PI))
      // B(1.5, 2.5) = Γ(1.5)Γ(2.5)/Γ(4) = (√π/2)(3√π/4)/6 = π/16
      assert(equal(special.beta(1.5, 2.5), Math.PI / 16))
    })

    it('should fall back to logGamma when min(x,y) > 30', () => {
      // beta(31, 31) has min=31 > 30, triggering the logGamma path
      const v = special.beta(31, 31)
      assert(Math.abs(v - 1.3861667124709484e-19) < 1e-30)
    })
  })
})
