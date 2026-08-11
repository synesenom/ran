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
