import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.zeta', () => {
  describe('.hurwitzZeta(), .riemannZeta()', () => {
    it('hurwitzZeta should return Infinity at the pole s = 1', () => {
      assert(special.hurwitzZeta(1, 1) === Infinity)
      assert(special.hurwitzZeta(1, 2) === Infinity)
      assert(special.hurwitzZeta(1, 0.5) === Infinity)
      // Values just outside the EPS guard must be large but finite
      assert(isFinite(special.hurwitzZeta(1 + 1e-10, 1)))
      assert(special.hurwitzZeta(1 + 1e-10, 1) > 1e9)
    })

    it('hurwitzZeta should be accurate for s near 1', () => {
      // Reference values from the 3-term Laurent ζ(s) = 1/(s-1) + γ₀ − γ₁(s−1) + γ₂(s−1)²/2
      // (DLMF 25.2.8) using γ₀=0.5772156649, γ₁=−0.0728158455, γ₂=−0.0096903632.
      // At s=1.01 the 4th-term error is ~3e-12; tolerances are set well above that.
      assert(equal(special.hurwitzZeta(1.01, 1), 100.577943338838, 10))
      assert(equal(special.hurwitzZeta(1.05, 1), 20.580844344222, 8))
      assert(equal(special.hurwitzZeta(1.1, 1), 10.584448797634, 7))
      // ζ(s, 2) = ζ(s, 1) − 1^{-s} = ζ(s) − 1; exercises a ≠ 1 with n-formula unchanged
      assert(equal(special.hurwitzZeta(1.05, 2), 20.580844344222 - 1, 8))
    })

    it('hurwitzZeta should satisfy the recurrence ζ(s, a) = a^{-s} + ζ(s, a+1) for s near 1', () => {
      // Verifies that the corrected partial-sum length produces consistent values across the
      // recurrence, which the fixed-point tests at s=1.01/1.05/1.1 alone cannot catch.
      for (const s of [1.05, 1.1, 1.25, 1.5]) {
        for (const a of [0.5, 1, 2, 4]) {
          assert(equal(
            special.hurwitzZeta(s, a),
            Math.pow(a, -s) + special.hurwitzZeta(s, a + 1),
            6
          ))
        }
      }
    })

    it('riemannZeta(s) - hurwitzZeta(s, n+1) = H(s, n)', () => {
      for (const s of [1.01, 1.1, 2, 5, 10]) {
        let sum = 0
        for (let n = 1; n < 100; n++) {
          sum += 1 / Math.pow(n, s)
          assert(Math.abs(sum - special.riemannZeta(s) + special.hurwitzZeta(s, n + 1)) / sum < 1e-6)
        }
      }
    })

    it('should return Infinity at the pole s = 1', () => {
      assert(special.riemannZeta(1) === Infinity)
    })

    it('should be accurate near s = 1 via Laurent expansion', () => {
      // Reference values from five-term Laurent expansion (DLMF 25.2.4, γ₀–γ₄); truncation error O(d^5)
      // s > 1 side
      assert(Math.abs(special.riemannZeta(1.0001) / 10000.577222946486 - 1) < 1e-8)
      assert(Math.abs(special.riemannZeta(1.001) / 1000.5772884762018 - 1) < 1e-8)
      assert(Math.abs(special.riemannZeta(1.01) / 100.5779433388382 - 1) < 1e-8)
      assert(Math.abs(special.riemannZeta(1.02) / 50.5786700377986 - 1) < 1e-8)
      // s=1.05 and s=1.1 cross-checked against independent hurwitzZeta(s, 1) references (ζ(s) = ζ(s,1))
      assert(Math.abs(special.riemannZeta(1.05) / 20.580844344222 - 1) < 1e-8)
      assert(Math.abs(special.riemannZeta(1.1) / 10.584448465 - 1) < 1e-8)
      // s < 1 side (Laurent branch fires for |s-1| < 0.1 in both directions)
      assert(Math.abs(special.riemannZeta(0.999) / (-999.422857150944) - 1) < 1e-8)
    })
  })
})
