import { assert } from 'chai'
import { describe, it } from 'mocha'
import { adTest, ksTest, _adinf, _adStatistic } from './test-utils'
import { float, seed } from '../src/core'

// Hand-computed A² for the symmetric reference sample u = [0.1, 0.3, 0.5, 0.7, 0.9].
// Each pair (u_i, u_{n+1-i}) collapses to 2*ln(u_i) so A² reduces to a closed form;
// see the research doc for the per-term breakdown.
const REF_SAMPLE = [0.1, 0.3, 0.5, 0.7, 0.9]
const REF_A2 = 0.130083462905258

describe('test-utils', () => {
  describe('_adinf', () => {
    // Stephens (1974) α = 0.01 critical value A²* ≈ 3.857 is rounded to 4 sig
    // figs; 5e-3 tolerance reflects that rounding, not Marsaglia's 6e-6
    // intrinsic adinf error — a polynomial-coefficient typo would shift the
    // value by ≫ 5e-3 and still trip this guard.
    it('should match the α=0.01 asymptotic critical value', () => {
      const p = _adinf(3.857)
      assert(Math.abs(p - 0.99) < 5e-3, `_adinf(3.857) = ${p}, expected ~0.99`)
    })

    // Continuity check at the piece boundary z = 2.
    it('should be continuous at the z=2 piece boundary', () => {
      const left = _adinf(2 - 1e-6)
      const right = _adinf(2 + 1e-6)
      assert(Math.abs(left - right) < 1e-5, `discontinuity at z=2: left=${left}, right=${right}`)
    })
  })

  describe('ksTest', () => {
    it('should accept a sample that matches the model CDF', () => {
      seed(12345)
      const sample = Array.from({ length: 1000 }, () => float())
      assert(ksTest(sample, x => x))
    })

    it('should reject a left-shifted sample at α = 0.01', () => {
      seed(12345)
      // Compressing to [0, 0.7) means the EDF saturates at 1 by x=0.7 while the
      // Uniform[0,1) model CDF is only 0.7 there, giving D ≈ 0.3 >> threshold ≈ 0.051.
      const sample = Array.from({ length: 1000 }, () => float() * 0.7)
      assert(!ksTest(sample, x => x))
    })
  })

  describe('adTest', () => {
    it('should compute the canonical A² statistic on a hand-checked reference sample', () => {
      const a2 = _adStatistic(REF_SAMPLE.slice(), x => x)
      assert(Math.abs(a2 - REF_A2) < 1e-12, `A² = ${a2}, expected ${REF_A2}`)
      // Sanity: A² ≈ 0.13 is well below any critical value, so adTest accepts.
      assert(adTest(REF_SAMPLE.slice(), x => x))
    })

    it('should accept a uniform sample drawn from the model CDF', () => {
      seed(12345)
      const sample = Array.from({ length: 1000 }, () => float())
      assert(adTest(sample, x => x))
    })

    it('should reject a sample whose shape disagrees with the model', () => {
      seed(12345)
      // Triangular (centre-heavy) sample tested against the unit-uniform CDF —
      // both supports are (0,1) so no clipping is triggered, rejection must come
      // from distributional shape rather than boundary saturation.
      const sample = Array.from({ length: 1000 }, () => (float() + float()) / 2)
      assert(!adTest(sample, x => x))
    })
  })
})
