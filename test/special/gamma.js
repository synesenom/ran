import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.gamma', () => {
  describe('.gamma(), .logGamma()', () => {
    it('logGamma(z) = ln(gamma(z))', () => {
      for (const x of [0.1, 0.5, 1, 1.5, 2, 3, 5, 10, 20, 50, 99.5]) {
        const g = special.gamma(x)
        const lng = special.logGamma(x)
        const err = Math.abs(Math.log(g) - lng)
        // when lng === 0 (x = 1, 2) relative error is undefined; check absolute instead
        assert(Math.abs(lng) < 1e-10 ? err < 1e-14 : err / Math.abs(lng) < 0.01)
      }
    })

    describe('.gamma()', () => {
      it('should return reference values (mpmath mp.dps=50)', () => {
        // Positive baseline plus the reflection branch at negative half-integers.
        assert(equal(special.gamma(0.5), 1.772453850905516, 14))
        assert(equal(special.gamma(-0.5), -3.544907701811032, 14))
        assert(equal(special.gamma(-1.5), 2.363271801207355, 14))
        assert(equal(special.gamma(-2.5), -0.9453087204829419, 14))
      })

      it('should return Infinity at the non-positive integer poles', () => {
        // ADR-0015: divergence returns Infinity specifically (not NaN, not a huge finite).
        assert.strictEqual(special.gamma(0), Infinity)
        assert.strictEqual(special.gamma(-1), Infinity)
        assert.strictEqual(special.gamma(-2), Infinity)
      })

      it('should stay full-precision within 1e-6 of a negative integer pole', () => {
        // mpmath mp.dps=60 evaluated at the exact double of (-1+1e-7) / (-2+1e-7); the
        // (-1)^n-signed reduced sin(πz) must not lose the fractional offset.
        assert(equal(special.gamma(-1 + 1e-7), -10000000.428048076, 13))
        assert(equal(special.gamma(-2 + 1e-7), 5000000.458472761, 13))
      })

      it('should not overflow prematurely for large finite arguments (z ~ 143-171)', () => {
        // The Lanczos tail used to form Math.pow(t, z+0.5) and Math.exp(-t) as separate
        // factors; the pow() alone overflows to Infinity around z=143, ~30 orders of
        // magnitude before Gamma(z) itself exceeds DBL_MAX (~1.7976931348623157e+308).
        // Tolerance is 1e-12, not 1e-14 like the other .gamma() reference checks: the
        // log-space Lanczos tail's own rounding compounds at this magnitude (measured
        // worst case ~1.12e-13 at z=150) — looser than 1e-13 but still four orders of
        // magnitude tighter than the values themselves (~1e260-1e306).
        // mpmath mp.dps=50: gamma(150) = 3.8089226376305697269859552435073693354597023857341e+260
        assert(equal(special.gamma(150), 3.80892263763057e+260, 12))
        // Gamma(171) = 7.2574156153079989673967282111292631147169916812964e+306 is the
        // largest integer argument still finite in double precision.
        assert(equal(special.gamma(171), 7.257415615307999e+306, 12))
      })

      it('should still return Infinity at the true float64 overflow boundary', () => {
        // mpmath mp.dps=50: gamma(172) = 1.2410180702176678234248405241031039926166055775017e+309,
        // which genuinely exceeds DBL_MAX (~1.7976931348623157e+308) — Infinity is correct here,
        // not a premature-overflow artifact.
        assert.strictEqual(special.gamma(172), Infinity)
      })
    })

    describe('.logGamma()', () => {
      it('should return reference values ln|Γ(z)| (mpmath mp.dps=50)', () => {
        // Positive baseline (direct Lanczos path) and the log-reflection branch at negative
        // half-integers. The g=7.5 9-term Lanczos achieves ~1e-15, so tolerance is 1e-14.
        // z = 0.25 exercises the 0 < z < 0.5 positive-reflection branch.
        assert(equal(special.logGamma(0.25), 1.2880225246980774, 14))
        assert(equal(special.logGamma(0.5), 0.5723649429247001, 14))
        assert(equal(special.logGamma(1.5), -0.12078223763524522, 14))
        assert(equal(special.logGamma(2.5), 0.2846828704729192, 14))
        // ln(2!) and ln(4!): pinned as mpmath literals, not Math.log() calls
        assert(equal(special.logGamma(3), 0.6931471805599453, 14))
        assert(equal(special.logGamma(5), 3.1780538303479458, 14))
        assert(equal(special.logGamma(10), 12.801827480081469, 14))
        assert(equal(special.logGamma(-0.5), 1.2655121234846454, 14))
        assert(equal(special.logGamma(-1.5), 0.860047015376481, 14))
        // z = -2.5: reflection subtracts log(π) - logGamma(3.5) ≈ 1.14 - 1.20; the ~5%
        // cancellation costs ~1 digit, limiting accuracy to ~2e-14 for this argument.
        assert(equal(special.logGamma(-2.5), -0.056243716497674054, 13))
      })

      it('should return Infinity at the non-positive integer poles', () => {
        // ADR-0015: divergence returns Infinity specifically (not NaN, not a huge finite).
        assert.strictEqual(special.logGamma(0), Infinity)
        assert.strictEqual(special.logGamma(-1), Infinity)
        assert.strictEqual(special.logGamma(-2), Infinity)
      })

      it('should stay full-precision within 1e-6 of a negative integer pole', () => {
        // mpmath mp.dps=60 at the exact double of (-1+1e-7) / (-2+1e-7); |sin(πz)| reduced mod π keeps the offset.
        assert(equal(special.logGamma(-1 + 1e-7), 16.118095693763127, 14))
        assert(equal(special.logGamma(-2 + 1e-7), 15.424948562092922, 14))
      })
    })
  })
})
