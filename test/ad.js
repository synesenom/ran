import { assert } from 'chai'
import { describe, it } from 'mocha'
import { ksTest } from './test-utils'
import { _adinf, _adStatistic, andersonDarling, andersonDarlingPValue, chi2PValue } from '../src/dist/_tests'
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

  describe('andersonDarling', () => {
    it('should compute the canonical A² statistic on a hand-checked reference sample', () => {
      const a2 = _adStatistic(REF_SAMPLE.slice(), x => x)
      assert(Math.abs(a2 - REF_A2) < 1e-12, `A² = ${a2}, expected ${REF_A2}`)
      // Sanity: A² ≈ 0.13 is well below any critical value, so andersonDarling accepts.
      assert(andersonDarling(REF_SAMPLE.slice(), x => x).passed)
    })

    it('should accept a uniform sample drawn from the model CDF', () => {
      seed(12345)
      const sample = Array.from({ length: 1000 }, () => float())
      assert(andersonDarling(sample, x => x).passed)
    })

    it('should throw for an empty sample', () => {
      assert.throws(() => andersonDarling([], x => x), /not be empty/)
    })

    it('should reject a sample whose shape disagrees with the model', () => {
      seed(12345)
      // Triangular (centre-heavy) sample tested against the unit-uniform CDF —
      // both supports are (0,1) so no clipping is triggered, rejection must come
      // from distributional shape rather than boundary saturation.
      const sample = Array.from({ length: 1000 }, () => (float() + float()) / 2)
      assert(!andersonDarling(sample, x => x).passed)
    })
  })

  describe('andersonDarlingPValue', () => {
    // mpmath mp.dps=50: Marsaglia & Marsaglia (2004) asymptotic formula
    // (adinf + finite-n errfix correction) independently re-implemented and
    // evaluated at A²=0.130083462905258 (REF_A2 above), n=5 → 1.000265361679237696.
    // The finite-n correction can push the approximation slightly past 1 for a
    // tiny, very-well-fitting sample — an artifact of the published approximation
    // itself, not of this implementation, so this is the exact expected value.
    it('should match the Marsaglia asymptotic formula on the hand-checked reference sample', () => {
      const p = andersonDarlingPValue(REF_SAMPLE.slice(), x => x)
      assert(Math.abs(p - 1.000265361679237696) < 1e-9, `p = ${p}, expected 1.000265361679237696`)
    })

    it('should throw for an empty sample', () => {
      assert.throws(() => andersonDarlingPValue([], x => x), /not be empty/)
    })

    it('should report a high p-value for a large uniform sample matching the model CDF', () => {
      seed(12345)
      const sample = Array.from({ length: 1000 }, () => float())
      assert(andersonDarlingPValue(sample, x => x) > 0.5)
    })

    it('should report a low p-value for a sample whose shape disagrees with the model', () => {
      seed(12345)
      const sample = Array.from({ length: 1000 }, () => (float() + float()) / 2)
      assert(andersonDarlingPValue(sample, x => x) < 0.01)
    })
  })

  describe('chi2PValue', () => {
    // scipy 1.17.1: scipy.stats.chi2.sf(2/3, 1) == scipy.special.gammaincc(0.5, 1/3)
    // == 0.4142161782425251. Hand-crafted binning: values = 20 copies each of
    // {1,2,3,4} (n=80), pmf = {1: 0.3, 2: 0.2, 3: 0.3, 4: 0.2} (uniform true
    // proportions are 0.25 each). The chi-square binning rule (merge consecutive
    // Map-insertion-order entries until expected count > 20) closes exactly two
    // bins — {1} alone (expected 24 > 20) and {2,3} together (expected 40 > 20) —
    // leaving trailing {4} (expected 16) uncounted, giving statistic (20-24)^2/24
    // + (40-40)^2/40 = 2/3 exactly and k=2 closed bins. With c=0 parameters,
    // df = max(1, k-c-1) = 1.
    it('should match the chi-square survival function on a hand-crafted binning case', () => {
      const values = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
        3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
        4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
      const pmf = x => ({ 1: 0.3, 2: 0.2, 3: 0.3, 4: 0.2 }[x])
      const p = chi2PValue(values, pmf, 0)
      assert(Math.abs(p - 0.4142161782425251) < 1e-9, `p = ${p}, expected 0.4142161782425251`)
    })

    it('should report a high p-value for data that matches the model pmf', () => {
      seed(12345)
      // Bernoulli(0.5)-like sample matching its own model pmf closely at n=2000
      const sample = Array.from({ length: 2000 }, () => (float() < 0.5 ? 0 : 1))
      const pmf = x => (x === 0 ? 0.5 : x === 1 ? 0.5 : 0)
      assert(chi2PValue(sample, pmf, 0) > 0.5)
    })
  })
})
