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

    it('should return negative values when Gamma-function sign composition demands it', () => {
      // B(x,y) = Gamma(x)Gamma(y)/Gamma(x+y) is negative whenever an odd number
      // of the three Gamma factors are negative (Gamma(z) < 0 on alternating
      // intervals between its poles at the non-positive integers for z < 0).
      // logGamma() intentionally returns ln|Gamma(z)|, so exponentiating a sum
      // of logGamma() calls can never reproduce that sign on its own.

      // mpmath mp.dps=50: x=-0.5, y=-0.4 -> Gamma(x)<0, Gamma(y)<0, Gamma(x+y)<0 (odd count negative)
      // beta(-0.5, -0.4) = -1.2485258633178250820366128993190870970770195996918 -> -1.2485258633178251 (float64)
      assert(equal(special.beta(-0.5, -0.4), -1.2485258633178251))

      // mpmath mp.dps=50: x=-0.5, y=3.2 -> Gamma(x)<0, Gamma(y)>0, Gamma(x+y)>0 (odd count negative)
      // beta(-0.5, 3.2) = -5.5627711756595414868182762437757763287249208213728 -> -5.562771175659542 (float64)
      assert(equal(special.beta(-0.5, 3.2), -5.562771175659542))

      // mpmath mp.dps=50: x=-1.5, y=-0.3 -> Gamma(x)>0, Gamma(y)<0, Gamma(x+y)>0 (odd count negative)
      // beta(-1.5, -0.3) = -3.2074183377160688798909279511573481663316185940018 -> -3.207418337716069 (float64)
      assert(equal(special.beta(-1.5, -0.3), -3.207418337716069))

      // mpmath mp.dps=50: x=-3.5, y=2.2 -> Gamma(x)>0, Gamma(y)>0, Gamma(x+y)>0 (even count negative)
      // beta(-3.5, 2.2) = 0.089408903986964266806315567263596114083506000110791 -> 0.08940890398696427 (float64)
      assert(equal(special.beta(-3.5, 2.2), 0.08940890398696427))
    })
  })
})
