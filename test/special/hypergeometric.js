import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.hypergeometric', () => {
  describe('.f11()', () => {
    const checkBesselIdentity = (aVals, zVals) => {
      for (const a of aVals) {
        for (const z of zVals) {
          assert(equal(
            special.f11(a, 2 * a, z),
            Math.exp(z / 2 + (0.5 - a) * Math.log(z / 4) + special.logGamma(a + 0.5)) * special.besselInu(a - 0.5, z / 2)
          ))
        }
      }
    }

    const checkF11Recurrence = (aVals, bVals, zVals) => {
      for (const a of aVals) {
        for (const b of bVals) {
          for (const z of zVals) {
            assert(equal(
              a * special.f11(a + 1, b, z),
              (b - a) * special.f11(a - 1, b, z) + (2 * a - b + z) * special.f11(a, b, z)
            ))
          }
        }
      }
    }

    describe('|z| < 50', () => {
      it('f11(0, b, z) = 1', () => {
        for (const b of [0.5, 1, 2]) {
          for (const z of [0, 1, 10, 40]) {
            assert(equal(special.f11(0, b, z), 1))
          }
        }
      })

      it('f11(b, b, z) = exp(z)', () => {
        for (const b of [0.5, 1, 2]) {
          for (const z of [0, 1, 10, 40]) {
            assert(equal(special.f11(b, b, z), Math.exp(z)))
          }
        }
      })

      it('f11(2, 1, z) = (1 + z) * exp(z)', () => {
        for (const z of [0, 1, 10, 40]) {
          assert(equal(special.f11(2, 1, z), (1 + z) * Math.exp(z)))
        }
      })

      it('f11(1, 2, z) = (exp(z) - 1) / z', () => {
        for (const z of [1, 10, 40]) {
          assert(equal(special.f11(1, 2, z), (Math.exp(z) - 1) / z))
        }
      })

      it('(2z / sqrt(pi)) * f11(0.5, 1.5, -z^2) = erf(z)', () => {
        for (const z of [0.1, 0.5, 1]) {
          assert(equal(2 * z * special.f11(0.5, 1.5, -z * z) / Math.sqrt(Math.PI), special.erf(z)))
        }
      })

      it('f11(a, 2a, z) = exp(z/2) (z/4)^(0.5 - a) gamma(a + 0.5) I(a - 0.5; z/2)', () => {
        checkBesselIdentity([0.5, 1, 2], [1, 10, 40])
      })

      it('a f11(a+1, b, z) = (b - a) f11(a-1, b, z) + (2a - b + z) f11(a, b, z)', () => {
        checkF11Recurrence([0.5, 1, 2], [0.5, 1, 2], [0, 1, 10, 40])
      })

      it('f11(1, 2, 49) = (exp(49) - 1) / 49 at 12-digit precision', () => {
        // Taylor series requires ~115 terms to converge at z=49; would fail at 10-digit precision with MAX_ITER=100.
        assert(equal(special.f11(1, 2, 49), (Math.exp(49) - 1) / 49, 12))
      })
    })

    describe('|z| >= 50', () => {
      it('f11(0, b, z) = 1', () => {
        for (const b of [0.5, 1, 2]) {
          for (const z of [50, 60, 75, 90]) {
            assert(equal(special.f11(0, b, z), 1))
          }
        }
      })

      it('f11(b, b, z) = exp(z)', () => {
        for (const b of [0.5, 1, 2]) {
          for (const z of [50, 60, 75, 90]) {
            assert(equal(special.f11(b, b, z), Math.exp(z)))
          }
        }
      })

      it('f11(2, 1, z) = (1 + z) * exp(z)', () => {
        for (const z of [50, 60, 75, 90]) {
          assert(equal(special.f11(2, 1, z), (1 + z) * Math.exp(z)))
        }
      })

      it('f11(1, 2, z) = (exp(z) - 1) / z', () => {
        for (const z of [50, 60, 75, 90]) {
          assert(equal(special.f11(1, 2, z), (Math.exp(z) - 1) / z))
        }
      })

      it('f11(a, 2a, z) = exp(z/2) (z/4)^(0.5 - a) gamma(a + 0.5) I(a - 0.5; z/2)', () => {
        checkBesselIdentity([0.5, 1, 2], [50, 60, 75, 90])
      })

      it('a * f11(a+1, b, z) = (b - a) * f11(a-1, b, z) + (2a - b + z) * f11(a, b, z)', () => {
        checkF11Recurrence([3, 7, 13], [3, 7, 13], [50, 60, 75, 90])
      })

      it('f11(1, 2, 50) = (exp(50) - 1) / 50', () => {
        assert(equal(special.f11(1, 2, 50), (Math.exp(50) - 1) / 50))
      })

      it('f11(1, 2, 100) = (exp(100) - 1) / 100', () => {
        assert(equal(special.f11(1, 2, 100), (Math.exp(100) - 1) / 100))
      })
    })

    describe('b <= 0 integer (pole)', () => {
      it('diverges to +Infinity, not an arbitrarily-signed Infinity, for b = 0, -1, -2', () => {
        // (b)_k Pochhammer denominator hits zero mid-recurrence at a non-positive integer b;
        // without an explicit guard this used to fall through to an unguarded division by zero
        // producing a sign that depended on b's parity (+Infinity at b=0, -Infinity at b=-1,
        // +Infinity at b=-2) rather than this codebase's established pole convention (gamma.js,
        // logGamma.js, riemannZeta.js, hurwitzZeta.js all diverge to +Infinity at their poles).
        for (const b of [0, -1, -2, -5]) {
          assert.strictEqual(special.f11(1, b, 3), Infinity)
        }
      })

      it('still fires when a is also a non-positive integer but a < b (denominator hits its zero first)', () => {
        // Unlike the a>b case below, here the (b)_k denominator's zero at k=|b|+1 comes before
        // the (a)_k numerator's own zero at k=|a|+1 (|a|>|b|), so the pole is genuinely reached
        // -- confirmed against mpmath, which itself raises ZeroDivisionError ("pole in
        // hypergeometric series") for hyp1f1(-3,-1,5) rather than returning a finite value.
        assert.strictEqual(special.f11(-3, -1, 5), Infinity)
      })

      it('does not fire when a is also a non-positive integer with a > b (numerator terminates the series first)', () => {
        // A review-caught regression: an earlier, overbroad version of the pole guard above
        // returned Infinity here too, even though (a)_k reaches zero at k=|a|+1, strictly
        // before the (b)_k denominator's own zero at k=|b|+1 -- the series is a well-defined
        // polynomial (mpmath mp.dps=50: hyp1f1(-1,-2,3)=2.5, hyp1f1(-2,-3,1)=11/6 exactly).
        assert(equal(special.f11(-1, -2, 3), 2.5))
        assert(equal(special.f11(-2, -3, 1), 11 / 6))
      })

      it('a = 0 takes priority over the b <= 0 pole guard', () => {
        // hypergeometric.js checks |a|<EPSILON before the pole guard -- f11(0, b, z) is exactly
        // 1 regardless of b, including a non-positive integer b that would otherwise be a pole.
        assert.strictEqual(special.f11(0, -3, 5), 1)
      })

      it('does not fire when a equals b (also excluded, but the true value is still not computed)', () => {
        // A second review-caught issue: a===b, both non-positive integers, is also excluded
        // from the pole guard (a>=b, not a>b) -- but unlike the a>b case above, this is NOT a
        // well-defined polynomial. (a)_k and (b)_k hit zero at the SAME index, a genuine 0/0
        // Pochhammer-ratio indeterminate form _f11TaylorSeries's recurrence cannot resolve; it
        // silently corrupts to NaN there (this is what falling through to it now produces,
        // pinned below), a pre-existing gap this guard does not attempt to fix. Excluding a===b
        // from the guard still matters: it stops the guard from *asserting* a provably wrong
        // +Infinity for this case (mpmath mp.dps=50: hyp1f1(-1,-1,5)=6, not a pole, and not
        // e^z either -- see test/precision-special.js's own WITHHELD entry for this exact
        // point). See issue #1424, filed specifically for this a===b defect (distinct from
        // #1423, a different f11 defect in the asymptotic branch) -- if #1424 is ever fixed,
        // this assertion and the WITHHELD entry above both need updating to the true finite
        // value instead of NaN.
        assert(Number.isNaN(special.f11(-1, -1, 5)))
      })

      it('does not fire for a negative non-integer b', () => {
        // Number.isInteger(b) must gate the guard -- a non-integer negative b is not a pole and
        // must fall through to the ordinary series evaluation.
        // mpmath mp.dps=50: hyp1f1(1, -2.5, 3) -> -887.4329677664421...
        assert(equal(special.f11(1, -2.5, 3), -887.4329677664421))
      })
    })
  })
})
