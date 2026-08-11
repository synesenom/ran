import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.gammaIncomplete', () => {
  describe('.gammaLowerIncomplete(), .gammaUpperIncomplete()', () => {
    it('should vanish below 0', () => {
      for (const s of [0.5, 1, 2, 5, 10]) {
        assert(special.gammaLowerIncomplete(s, -10) === 0)
      }
    })

    // Reference values from mpmath at mp.dps=70.
    it('should match mpmath reference values in the deep series branch (x << a)', () => {
      // Series expansion path: x < s+1
      assert(equal(special.gammaLowerIncomplete(5, 0.5), 1.7211562995584078e-4))
      assert(equal(special.gammaLowerIncomplete(10, 1.0), 1.1142547833872067e-7))
      assert(equal(special.gammaLowerIncomplete(50, 5.0), 2.1810592140784887e-32))
      // Complementary upper values
      assert(equal(special.gammaUpperIncomplete(5, 0.5), 0.9998278843700441))
      assert(equal(special.gammaUpperIncomplete(10, 1.0), 0.9999998885745217))
    })

    it('should match mpmath reference values in the crossover region (x near a)', () => {
      // Near x = a the series and CF both converge most slowly; the implementation uses
      // the series branch (x < s+1) here.
      assert(equal(special.gammaLowerIncomplete(5, 5.0), 0.5595067149347875))
      assert(equal(special.gammaUpperIncomplete(5, 5.0), 0.4404932850652124))
      assert(equal(special.gammaLowerIncomplete(10, 10.0), 0.5420702855281478))
      assert(equal(special.gammaUpperIncomplete(10, 10.0), 0.4579297144718522))
      assert(equal(special.gammaLowerIncomplete(50, 50.0), 0.5188083154720433))
      assert(equal(special.gammaUpperIncomplete(50, 50.0), 0.48119168452795674))
    })

    it('should match mpmath reference values in the deep CF branch (x >> a)', () => {
      // Continued-fraction path: x >= s+1; upper incomplete gamma computed directly.
      assert(equal(special.gammaUpperIncomplete(1, 20.0), 2.061153622438558e-9))
      assert(equal(special.gammaUpperIncomplete(5, 50.0), 5.4497019829205295e-17, 10))
      assert(equal(special.gammaUpperIncomplete(10, 100.0), 1.1253473960842733e-31, 10))
    })

    it('should match mpmath reference values for large a', () => {
      // Large shape parameter; series branch is used (x = a < a+1).
      assert(equal(special.gammaLowerIncomplete(100, 100.0), 0.5132987982791487))
      assert(equal(special.gammaUpperIncomplete(100, 100.0), 0.48670120172085135))
      assert(equal(special.gammaLowerIncomplete(1000, 1000.0), 0.5042052441802155))
      assert(equal(special.gammaUpperIncomplete(1000, 1000.0), 0.4957947558197845))
    })

    // mpmath mp.dps=50: mp.gammainc(s, x, mp.inf, regularized=True). CF branch (x >= s+1)
    // with s and x both large and close together -- the near-diagonal regime where _gui's
    // MAX_ITER=100 cap silently truncated before convergence and its shared prefactor with
    // _gli cancelled two ~4e4-magnitude terms down to an O(1) result (#1348).
    it('should match mpmath reference values in the near-diagonal large-s CF branch', () => {
      assert(equal(special.gammaUpperIncomplete(4989, 5000), 0.436307027364574, 13))
      assert(equal(special.gammaUpperIncomplete(4995, 5000), 0.46993291332034903, 13))
      assert(equal(special.gammaUpperIncomplete(4998, 5000), 0.48683689071721553, 13))
    })

    it('P + Q should equal 1 for all algorithm regions', () => {
      const pairs = [
        [5, 0.5], [10, 1.0], [50, 5.0],
        [5, 5.0], [10, 10.0], [50, 50.0],
        [1, 20.0], [5, 50.0], [10, 100.0],
        [100, 100.0], [1000, 1000.0]
      ]
      for (const [s, x] of pairs) {
        const p = special.gammaLowerIncomplete(s, x)
        const q = special.gammaUpperIncomplete(s, x)
        assert(equal(p + q, 1))
      }
    })

    it('should converge to gamma(s) as x -> inf', () => {
      for (const s of [0.5, 1, 2, 5, 10]) {
        assert(equal(special.gammaLowerIncomplete(s, 1e5), 1))
      }
    })
  })

  describe('.gammaLowerIncompleteInv()', () => {
    it('should return 0 for p = 0', () => {
      for (const a of [1, 2, 5, 10, 20]) {
        assert(special.gammaLowerIncompleteInv(a, 0) === 0)
      }
    })

    it('should return Infinity for p = 1', () => {
      for (const a of [1, 2, 5, 10, 20]) {
        assert(special.gammaLowerIncompleteInv(a, 1) === Infinity)
      }
    })

    it('should round-trip with gammaLowerIncomplete for a >= 1', () => {
      for (const a of [1, 2, 5, 10, 20]) {
        for (const p of [0.01, 0.1, 0.5, 0.9, 0.99]) {
          const x = special.gammaLowerIncompleteInv(a, p)
          assert(Math.abs(special.gammaLowerIncomplete(a, x) - p) < 1e-10)
        }
      }
    })

    it('should round-trip with gammaLowerIncomplete for a < 1', () => {
      for (const a of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        for (const p of [0.01, 0.1, 0.5, 0.9, 0.99]) {
          const x = special.gammaLowerIncompleteInv(a, p)
          assert(Math.abs(special.gammaLowerIncomplete(a, x) - p) < 1e-10)
        }
      }
    })

    it('should return a known value: gammaLowerIncompleteInv(2, 0.5) ≈ 1.6783', () => {
      // gammaLowerIncomplete(2, 1.6783469900166612) = 0.5 exactly
      assert(Math.abs(special.gammaLowerIncompleteInv(2, 0.5) - 1.6783469900166612) < 1e-10)
    })

    it('should handle extreme lower tail (small p)', () => {
      const x = special.gammaLowerIncompleteInv(5, 1e-10)
      assert(isFinite(x) && x > 0)
      assert(Math.abs(special.gammaLowerIncomplete(5, x) - 1e-10) < 1e-15)
    })

    it('should converge for very small p (p = 1e-30, a = 1)', () => {
      // mpmath: -log(1 - 1e-30) ≈ 1e-30; round-trip must recover p to relative 1e-10
      const x = special.gammaLowerIncompleteInv(1, 1e-30)
      assert(isFinite(x) && x > 0)
      assert(Math.abs(special.gammaLowerIncomplete(1, x) - 1e-30) / 1e-30 < 1e-10)
    })

    it('should converge for p = 1e-31, a = 0.1 where x_true < 1e-300', () => {
      // Leading-term inversion gives x_true ≈ (p * Gamma(1.1))^10 ≈ 6e-311, below 1e-300.
      // The old absolute 1e-300 floor clamped the iterate upward and stalled convergence.
      const x = special.gammaLowerIncompleteInv(0.1, 1e-31)
      assert(isFinite(x) && x > 0 && x < 1e-300)
      assert(Math.abs(special.gammaLowerIncomplete(0.1, x) - 1e-31) / 1e-31 < 1e-10)
    })

    it('should handle extreme upper tail (p close to 1)', () => {
      const x = special.gammaLowerIncompleteInv(5, 1 - 1e-10)
      assert(isFinite(x) && x > 0)
      assert(Math.abs(special.gammaLowerIncomplete(5, x) - (1 - 1e-10)) < 1e-10)
    })
  })
})
