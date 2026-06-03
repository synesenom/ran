import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal, repeat } from './test-utils.js'
import * as special from '../src/special/index.js'

const LAPS = 100

describe('special', () => {
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
      repeat(() => {
        const z = Math.random() * 100 + 0.1
        assert(equal(special.digamma(z + 1), special.digamma(z) + 1 / z))
      }, LAPS)
    })
  })

  /*
  describe('digamma(z)', () => {
    it('should return reference values', () => {
      assert(equal(digamma(1), -em))
      assert(equal(digamma(0.5), -em - 2 * Math.log(2)))
      assert(equal(digamma(1 / 4), -Math.PI / 2 - 3 * Math.log(2) - em))
    })

    it('should give the harmonic number for integers', () => {
      repeat(() => {
        let z = Math.floor(Math.random() * 100) + 1
        assert(equal(digamma(z), digamma(z + 1) - 1 / z))
      }, LAPS)
    })
  })

  describe('f21(a, b, c, z)', () => {
    describe('z < -1', () => {
      it('TEST', () => {
        let z = 1 + Math.random() * 10
        console.log(
          f21(0.5, 0.5, 1.5, -z * z),
          Math.log(z + Math.sqrt(1 + z * z)) / z
        )
      })
    })

    describe('-1 <= z < 0', () => {
    })

    describe('0 <= z <= 0.5', () => {

    })

    describe('0.5 < z <= 1', () => {})

    describe('1 < z <= 2', () => {})

    describe('2 < z', () => {

    })
  })
  */

  describe('.bessel()', () => {
    it('In(0) should be equal to 0 for n > 1', () => {
      repeat(() => {
        const n = Math.floor(1 + 10 * Math.random())
        assert(special.besselI(n, 0) === 0)
      })
    })

    it('I1(-x) should be equal to -I1(x)', () => {
      repeat(() => {
        const x = 1 + 10 * Math.random()
        assert(equal(special.besselI(1, -x), -special.besselI(1, x)))
      })
    })

    it('In(-x) should be equal to -In(x) for odd n >= 3', () => {
      // Regression for the backward-recurrence sign bug fixed in #255: abs(x) with no sign
      // correction caused I_n(-x) != -I_n(x) for odd n >= 3
      repeat(() => {
        const x = 1 + 10 * Math.random()
        assert(equal(special.besselI(3, -x), -special.besselI(3, x)))
        assert(equal(special.besselI(5, -x), -special.besselI(5, x)))
        assert(equal(special.besselI(7, -x), -special.besselI(7, x)))
      })
    })

    it('I1(x) should match scipy reference values', () => {
      // scipy.stats cross-validation; these were the values broken by the old _I1 polynomial
      assert(equal(special.besselI(1, 2), 1.590636854637329))
      assert(equal(special.besselI(1, 10), 2670.988303701254))
    })

    it('I1(x) should match reference values at large arguments', () => {
      // Independent sanity check: leading asymptotic I_1(x) ~ e^x/sqrt(2*pi*x) agrees
      // with the Miller result to < 1% at x=50 (asymptotic is accurate to ~0.5% with
      // one correction term), confirming the normalization is not off by any power of e^x.
      assert(Math.abs(special.besselI(1, 50) * Math.sqrt(2 * Math.PI * 50) / Math.exp(50) - 1) < 0.01)
      assert(equal(special.besselI(1, 50), 2.9030785901035533e+20))
      assert(equal(special.besselI(1, 100), 1.0683693903381671e+42))
      assert(equal(special.besselI(1, 200), 2.0345815493320935e+85))
    })

    it('I1(x) sign symmetry should hold at large arguments', () => {
      // Exercises the x < 0 && n % 2 === 1 sign-correction branch for large |x|.
      assert(equal(special.besselI(1, -50), -special.besselI(1, 50)))
    })

    it('I0(x) should match reference values at large arguments', () => {
      // besselI(0, x) also used _I0(x) directly; this confirms the large-x fix.
      assert(equal(special.besselI(0, 50), 2.9325537838493486e+20))
      assert(equal(special.besselI(0, 100), 1.073751707131081e+42))
      assert(equal(special.besselI(0, 200), 2.0396871734097203e+85))
    })

    it('I0(x) should be continuous across the |x|=10 routing boundary', () => {
      // Verifies _I0 (|x|<=10) and _besselIBackward (|x|>10) agree near the crossover.
      assert(equal(special.besselI(0, 9.9), 2560.9633532560433))
      assert(equal(special.besselI(0, 10), 2815.716628466255))
      assert(equal(special.besselI(0, 10.1), 3095.9756729321825))
    })
  })

  describe('.besselISpherical()', () => {
    it('i(0, 0) should be 1', () => {
      assert(special.besselISpherical(0, 0) === 1)
    })

    it('i(1, 0) should be 0', () => {
      assert(special.besselISpherical(1, 0) === 0)
    })

    it('i(n, 0) should be 1 for n > 0', () => {
      const n = Math.floor(1 + 10 * Math.random())
      assert(special.besselISpherical(n, 0) === 0)
    })

    it('should satisfy the recurrence relation for negative order', () => {
      repeat(() => {
        const n = -Math.floor(1 + 10 * Math.random())
        const x = 10 * Math.random()
        assert(equal(special.besselISpherical(n - 1, x) - special.besselISpherical(n + 1, x),
          (2 * n + 1) * special.besselISpherical(n, x) / x))
      })
    })

    it('should satisfy the recurrence relation for positive order', () => {
      repeat(() => {
        const n = Math.floor(1 + 10 * Math.random())
        const x = 10 * Math.random()
        assert(equal(special.besselISpherical(n - 1, x) - special.besselISpherical(n + 1, x),
          (2 * n + 1) * special.besselISpherical(n, x) / x))
      })
    })

    it('should return accurate small-x values for n=1', () => {
      // i_1(x) = x/3 + x³/30 + x⁵/840 + ...; (2*1+1)!! = 3
      assert(special.besselISpherical(1, 0) === 0)
      // At x=1e-6 the second term is ~3.7e-20, negligible vs 1e-10 relative tolerance
      assert(equal(special.besselISpherical(1, 1e-6), 1e-6 / 3, 10))
      // At x=1e-3 include two terms (third term ~3.6e-15 relative)
      assert(equal(special.besselISpherical(1, 1e-3), 1e-3 / 3 + 1e-9 / 30, 10))
      // At x=0.1 (Taylor branch): hand-computed from series
      assert(equal(special.besselISpherical(1, 0.1), 0.03336667857363341, 10))
    })

    it('should return accurate small-x values for n=2', () => {
      // i_2(x) = x²/15 + x⁴/210 + ...; (2*2+1)!! = 5!! = 15
      assert(special.besselISpherical(2, 0) === 0)
      // At x=1e-6 the second term is ~7e-14 relative
      assert(equal(special.besselISpherical(2, 1e-6), 1e-12 / 15, 10))
      // At x=1e-3 include two terms x²/15 + x⁴/210 (third term ~2e-15 relative)
      assert(equal(special.besselISpherical(2, 1e-3), 1e-6 / 15 + 1e-12 / 210, 10))
      // At x=0.1 (Taylor branch): hand-computed from series
      assert(equal(special.besselISpherical(2, 0.1), 6.671429894380334e-4, 10))
    })

    it('should return accurate small-x values for n=5', () => {
      // i_5(x) = x⁵/10395 + ...; (2*5+1)!! = 11!! = 10395, 13!! = 135135
      assert(special.besselISpherical(5, 0) === 0)
      // At x=1e-6 the second term is ~4e-14 relative
      assert(equal(special.besselISpherical(5, 1e-6), 1e-30 / 10395, 10))
      // At x=1e-3 include two terms x⁵/10395 + x⁷/270270 (third term ~6e-16 relative)
      assert(equal(special.besselISpherical(5, 1e-3), 1e-15 / 10395 + 1e-21 / 270270, 10))
      // At x=0.1 (Taylor branch): hand-computed from series
      assert(equal(special.besselISpherical(5, 0.1), 9.62371024043737e-10, 10))
    })

    it('should satisfy positive-order recurrence in the Taylor branch', () => {
      repeat(() => {
        const n = Math.floor(1 + 10 * Math.random())
        const x = 0.01 + 0.98 * Math.random()
        assert(equal(special.besselISpherical(n - 1, x) - special.besselISpherical(n + 1, x),
          (2 * n + 1) * special.besselISpherical(n, x) / x))
      })
    })
  })

  describe('.besselInu()', () => {
    it('should return accurate small-x values (regression)', () => {
      // These values must not change — they confirm the Taylor series is undisturbed at small x.
      assert(equal(special.besselInu(0.5, 1), 0.9376748882454871))
      assert(equal(special.besselInu(1.5, 1), 0.29352532634747946))
      assert(equal(special.besselInu(2.3, 1), 0.08157483645893206))
      assert(equal(special.besselInu(0.5, 10), 2778.7846038745683))
      assert(equal(special.besselInu(1.5, 10), 2500.906154942116))
      assert(equal(special.besselInu(2.3, 10), 2132.6900841622582))
    })

    it('should match the asymptotic leading term for nu=0.5 at x=50', () => {
      // I_{0.5}(x) ~ e^x / sqrt(2*pi*x) exactly (all correction terms vanish for nu=0.5
      // because mu = 4*0.25 = 1, so mu-1 = 0). Relative error < 1% verifies the
      // normalization is not off by any power of e^x.
      assert(Math.abs(special.besselInu(0.5, 50) * Math.sqrt(2 * Math.PI * 50) / Math.exp(50) - 1) < 0.01)
    })

    it('should return accurate large-argument values for nu=0.5 (exact formula)', () => {
      // I_{0.5}(x) = sqrt(2/(pi*x)) * sinh(x); these are cross-validated against that formula.
      assert(equal(special.besselInu(0.5, 50), 2.9251568529912876e+20))
      assert(equal(special.besselInu(0.5, 100), 1.0724035825423096e+42))
      assert(equal(special.besselInu(0.5, 200), 2.0384095654829366e+85))
    })

    it('should return accurate large-argument values for nu=1.5 (exact formula)', () => {
      // I_{1.5}(x) = sqrt(2/(pi*x)) * (cosh(x) - sinh(x)/x); cross-validated against that formula.
      assert(equal(special.besselInu(1.5, 50), 2.866653715931459e+20))
      assert(equal(special.besselInu(1.5, 100), 1.0616795467168857e+42))
      assert(equal(special.besselInu(1.5, 200), 2.0282175176555217e+85))
    })

    it('should return accurate large-argument values for nu=2.3 (asymptotic-validated)', () => {
      // No closed form; values computed by the Taylor series and verified to 1e-15 relative
      // error against the DLMF 10.40.1 asymptotic expansion with optimal truncation.
      assert(equal(special.besselInu(2.3, 50), 2.779977151326617e+20))
      assert(equal(special.besselInu(2.3, 100), 1.0455847305178129e+42))
      assert(equal(special.besselInu(2.3, 200), 2.0128232824293037e+85))
    })
  })

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

  describe('.betaIncomplete()', () => {
    it('B(a, b, x) should be equal to 0 if b > 0 and x <= 0', () => {
      assert(special.betaIncomplete(Math.random(), Math.random() + 1, -Math.random()) === 0)
    })

    it('B(a, b, x) should be equal to 1 if b > 0 and x >= 1', () => {
      assert(special.betaIncomplete(Math.random(), Math.random() + 1, 1 + Math.random()) === 1)
    })
  })

  describe('.f11()', () => {
    describe('|z| < 50', () => {
      it('f11(0, b, z) = 1', () => {
        repeat(() => {
          const b = Math.random()
          const z = Math.random() * 40
          assert(equal(special.f11(0, b, z), 1))
        }, LAPS)
      })

      it('f11(b, b, z) = exp(z)', () => {
        repeat(() => {
          const b = Math.random() * 10
          const z = Math.random() * 40
          assert(equal(special.f11(b, b, z), Math.exp(z)))
        }, LAPS)
      })

      it('f11(2, 1, z) = (1 + z) * exp(z)', () => {
        repeat(() => {
          const z = Math.random() * 40
          assert(equal(special.f11(2, 1, z), (1 + z) * Math.exp(z)))
        }, LAPS)
      })

      it('f11(1, 2, z) = (exp(z) - 1) / z', () => {
        repeat(() => {
          const z = Math.random() * 40
          assert(equal(special.f11(1, 2, z), (Math.exp(z) - 1) / z))
        }, LAPS)
      })

      it('(2z / sqrt(pi)) * f11(0.5, 1.5, -z^2) = erf(z)', () => {
        repeat(() => {
          const z = Math.random()
          assert(equal(2 * z * special.f11(0.5, 1.5, -z * z) / Math.sqrt(Math.PI), special.erf(z)))
        }, LAPS)
      })

      it('f11(a, 2a, z) = exp(z/2) (z/4)^(0.5 - a) gamma(a + 0.5) I(a - 0.5; z/2)', () => {
        repeat(() => {
          const a = Math.random() * 10
          const z = Math.random() * 40
          assert(equal(
            special.f11(a, 2 * a, z),
            Math.exp(z / 2 + (0.5 - a) * Math.log(z / 4) + special.logGamma(a + 0.5)) * special.besselInu(a - 0.5, z / 2)
          ))
        }, LAPS)
      })

      it('a f11(a+1, b, z) = (b - a) f11(a-1, b, z) + (2a - b + z) f11(a, b, z)', () => {
        repeat(() => {
          const a = Math.random() * 10
          const b = Math.random() * 10
          const z = Math.random() * 40
          assert(equal(
            a * special.f11(a + 1, b, z),
            (b - a) * special.f11(a - 1, b, z) + (2 * a - b + z) * special.f11(a, b, z)
          ))
        }, LAPS)
      })

      it('f11(1, 2, 49) = (exp(49) - 1) / 49 at 12-digit precision', () => {
        // Taylor series requires ~115 terms to converge at z=49; would fail at 10-digit precision with MAX_ITER=100.
        assert(equal(special.f11(1, 2, 49), (Math.exp(49) - 1) / 49, 12))
      })
    })

    describe('|z| >= 50', () => {
      it('f11(0, b, z) = 1', () => {
        repeat(() => {
          const b = Math.random()
          const z = Math.random() * 40 + 50
          assert(equal(special.f11(0, b, z), 1))
        }, LAPS)
      })

      it('f11(b, b, z) = exp(z)', () => {
        repeat(() => {
          const b = Math.random() * 10
          const z = Math.random() * 40 + 50
          assert(equal(special.f11(b, b, z), Math.exp(z)))
        }, LAPS)
      })

      it('f11(2, 1, z) = (1 + z) * exp(z)', () => {
        repeat(() => {
          const z = Math.random() * 40 + 50
          assert(equal(special.f11(2, 1, z), (1 + z) * Math.exp(z)))
        }, LAPS)
      })

      it('f11(1, 2, z) = (exp(z) - 1) / z', () => {
        repeat(() => {
          const z = Math.random() * 40 + 50
          assert(equal(special.f11(1, 2, z), (Math.exp(z) - 1) / z))
        }, LAPS)
      })

      it('f11(a, 2a, z) = exp(z/2) (z/4)^(0.5 - a) gamma(a + 0.5) I(a - 0.5; z/2)', () => {
        repeat(() => {
          const a = Math.random() * 10
          const z = Math.random() * 40 + 50
          assert(equal(
            special.f11(a, 2 * a, z),
            Math.exp(z / 2 + (0.5 - a) * Math.log(z / 4) + special.logGamma(a + 0.5)) * special.besselInu(a - 0.5, z / 2)
          ))
        }, LAPS)
      })

      it('a * f11(a+1, b, z) = (b - a) * f11(a-1, b, z) + (2a - b + z) * f11(a, b, z)', () => {
        repeat(() => {
          const a = Math.random() * 10 + 3
          const b = Math.random() * 10 + 3
          const z = Math.random() * 40 + 50
          assert(equal(
            a * special.f11(a + 1, b, z),
            (b - a) * special.f11(a - 1, b, z) + (2 * a - b + z) * special.f11(a, b, z)
          ))
        })
      })

      it('f11(1, 2, 50) = (exp(50) - 1) / 50', () => {
        assert(equal(special.f11(1, 2, 50), (Math.exp(50) - 1) / 50))
      })

      it('f11(1, 2, 100) = (exp(100) - 1) / 100', () => {
        assert(equal(special.f11(1, 2, 100), (Math.exp(100) - 1) / 100))
      })
    })
  })

  describe('.gamma(), .logGamma()', () => {
    it('logGamma(z) = ln(gamma(z))', () => {
      for (let i = 0; i < LAPS; i++) {
        const x = Math.random() * 100

        const g = special.gamma(x)

        const lng = special.logGamma(x)
        assert(Math.abs(Math.log(g) - lng) / lng < 0.01)
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

  describe('.gammaLowerIncomplete(), .gammaUpperIncomplete()', () => {
    it('should vanish below 0', () => {
      repeat(() => {
        const s = 2 + Math.random() * 10

        const x = -10
        assert(special.gammaLowerIncomplete(s, x) === 0)
      }, LAPS)
    })
    it('should be equal to exp(-x) for s = 1', () => {
      repeat(() => {
        const x = Math.random() * 100

        const gui = special.gammaUpperIncomplete(1, x) * special.gamma(1)
        assert(Math.abs(gui - Math.exp(-x)) / gui < 0.01)
      }, LAPS)
    })

    it('should be equal to sqrt(pi) * erf(sqrt(x)) for s = 1/2', () => {
      repeat(() => {
        const x = Math.random() * 100

        const gli = special.gammaLowerIncomplete(0.5, x) * special.gamma(0.5)
        assert(Math.abs(gli - Math.sqrt(Math.PI) * special.erf(Math.sqrt(x))) / gli < 0.01)
      }, LAPS)
    })

    it('should converge to x^s / s as x -> 0', () => {
      for (let i = 0; i < LAPS; i++) {
        const s = Math.random()

        const x = 1e-5 * (1 + Math.random())

        const xs = Math.pow(x, s)

        const gli = special.gammaLowerIncomplete(s, x) * special.gamma(s)
        if (xs > 1e-100) {
          assert(Math.abs(gli / Math.pow(x, s) * s - 1) < 0.01)
        }
      }
    })

    it('should converge to gamma(s) as x -> inf', () => {
      for (let i = 0; i > LAPS; i++) {
        const s = Math.random() * 100
        const x = 1e5 + Math.random() * 1e5
        assert(equal(special.gammaLowerIncomplete(s, x), 1))
      }
    })
  })

  describe('.gammaLowerIncompleteInv()', () => {
    it('should return 0 for p = 0', () => {
      repeat(() => {
        const a = 0.5 + Math.random() * 10
        assert(special.gammaLowerIncompleteInv(a, 0) === 0)
      }, LAPS)
    })

    it('should return Infinity for p = 1', () => {
      repeat(() => {
        const a = 0.5 + Math.random() * 10
        assert(special.gammaLowerIncompleteInv(a, 1) === Infinity)
      }, LAPS)
    })

    it('should round-trip with gammaLowerIncomplete for a >= 1', () => {
      repeat(() => {
        const a = 1 + Math.random() * 20
        const p = 0.01 + Math.random() * 0.98
        const x = special.gammaLowerIncompleteInv(a, p)
        assert(Math.abs(special.gammaLowerIncomplete(a, x) - p) < 1e-10)
      }, LAPS)
    })

    it('should round-trip with gammaLowerIncomplete for a < 1', () => {
      repeat(() => {
        const a = 0.1 + Math.random() * 0.9
        const p = 0.01 + Math.random() * 0.98
        const x = special.gammaLowerIncompleteInv(a, p)
        assert(Math.abs(special.gammaLowerIncomplete(a, x) - p) < 1e-10)
      }, LAPS)
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
      repeat(() => {
        const s = 1.05 + Math.random() * 0.45
        const a = 0.5 + Math.random() * 4
        assert(equal(
          special.hurwitzZeta(s, a),
          Math.pow(a, -s) + special.hurwitzZeta(s, a + 1),
          6
        ))
      }, LAPS)
    })

    it('riemannZeta(s) - hurwitzZeta(s, n+1) = H(s, n)', () => {
      repeat(() => {
        // Avoid s < 1.5: riemannZeta uses Wynn-epsilon there with ~1e-7 absolute error
        // while hurwitzZeta is now accurate to machine precision, so the identity check
        // would see a spurious mismatch. The near-1 precision is covered by the test above.
        const s = Math.random() * 9.5 + 1.5
        let sum = 0
        for (let n = 1; n < 100; n++) {
          sum += 1 / Math.pow(n, s)
          assert(Math.abs(sum - special.riemannZeta(s) + special.hurwitzZeta(s, n + 1)) / sum < 1e-6)
        }
      }, LAPS)
    })

    it('should return Infinity at the pole s = 1', () => {
      assert(special.riemannZeta(1) === Infinity)
    })

    it('should be accurate near s = 1 via Laurent expansion', () => {
      // Reference values from three-term Laurent expansion (DLMF 25.2.8); two-term truncation error is O(d^2)
      // s > 1 side
      assert(Math.abs(special.riemannZeta(1.0001) / 10000.577222946486 - 1) < 1e-8)
      assert(Math.abs(special.riemannZeta(1.001) / 1000.5772884762018 - 1) < 1e-8)
      assert(Math.abs(special.riemannZeta(1.01) / 100.5779433388382 - 1) < 1e-7) // looser: truncation error scales as d^2
      // s < 1 side (Laurent branch fires for |s-1| < 0.01 in both directions)
      assert(Math.abs(special.riemannZeta(0.999) / (-999.422857150944) - 1) < 1e-8)
    })
  })

  describe('.lambertW0()', () => {
    it('should return NaN for z < -1/e', () => {
      assert(isNaN(special.lambertW0(-1)))
      assert(isNaN(special.lambertW0(-0.5)))
      assert(isNaN(special.lambertW0(-Math.exp(-1) - 1e-10)))
    })

    it('should return -1 at the branch point z = -1/e', () => {
      assert(Math.abs(special.lambertW0(-Math.exp(-1)) + 1) < 1e-6)
    })

    it('should return 0 at z = 0', () => {
      assert(special.lambertW0(0) === 0)
    })

    it('should return 1 at z = e', () => {
      assert(equal(special.lambertW0(Math.E), 1))
    })

    it('should satisfy the W * exp(W) = x equation for x >= 0', () => {
      repeat(() => {
        const x = Math.random() * 10
        const w = special.lambertW0(x)
        assert(equal(w * Math.exp(w), x))
      }, LAPS)
    })

    it('should satisfy the W * exp(W) = x equation for x in [-1/e, 0)', () => {
      repeat(() => {
        const x = -(Math.random() * (1 / Math.E - 1e-9) + 1e-9)
        const w = special.lambertW0(x)
        assert(equal(w * Math.exp(w), x))
      }, LAPS)
    })
  })

  describe('.lambertW1m()', () => {
    it('should return NaN for z < -1/e', () => {
      assert(isNaN(special.lambertW1m(-1)))
      assert(isNaN(special.lambertW1m(-0.5)))
      assert(isNaN(special.lambertW1m(-Math.exp(-1) - 1e-10)))
    })

    it('should return NaN for z >= 0', () => {
      assert(isNaN(special.lambertW1m(0)))
      assert(isNaN(special.lambertW1m(1)))
      assert(isNaN(special.lambertW1m(0.1)))
    })

    it('should return -1 at the branch point z = -1/e', () => {
      assert(Math.abs(special.lambertW1m(-Math.exp(-1)) + 1) < 1e-6)
    })

    it('should return known value at z = -0.1', () => {
      assert(equal(special.lambertW1m(-0.1), -3.577152063957297))
    })

    it('should satisfy the W * exp(W) = x equation', () => {
      repeat(() => {
        const x = -(Math.random() * (1 / Math.E - 1e-9) + 1e-9)
        const w = special.lambertW1m(x)
        assert(equal(w * Math.exp(w), x))
      }, LAPS)
    })

    it('should return known values near the branch cut', () => {
      assert(equal(special.lambertW1m(-0.2), -2.5426413577735265))
      assert(equal(special.lambertW1m(-0.05), -4.499755288523487))
    })

    it('should satisfy W * exp(W) = z near the branch cut (z in [-1/e, -0.1])', () => {
      repeat(() => {
        const x = -(Math.random() * (1 / Math.E - 0.1) + 0.1)
        const w = special.lambertW1m(x)
        assert(equal(w * Math.exp(w), x))
      }, LAPS)
    })
  })

  describe('.marcumQ()', () => {
    describe('special cases', () => {
      describe('x = 0', () => {
        it('should satisfy the recurrence relation', () => {
          const x = Math.random() * 30
          const y = 0
          const mu = 2 + Math.random() * 5

          assert(equal(special.marcumQ(mu, x, y), 1))
        })
      })

      describe('y = 1', () => {
        it('should satisfy the recurrence relation', () => {
          repeat(() => {
            const x = 0
            const y = 40 + Math.random() * 60
            const mu = 2 + Math.random() * 5

            assert(equal(special.marcumQ(mu, x, y), special.gammaUpperIncomplete(mu, y)))
          }, LAPS)
        })
      })
    })

    describe('series expansion', () => {
      describe('Q', () => {
        it('should satisfy the recurrence relation', () => {
          repeat(() => {
            const x = Math.random() * 30
            const y = 40 + Math.random() * 60
            const mu = 2 + Math.random() * 5

            const q1 = special.marcumQ(mu + 1, x, y)
            const q2 = special.marcumQ(mu, x, y)
            const q3 = special.marcumQ(mu + 2, x, y)
            const q4 = special.marcumQ(mu - 1, x, y)

            if (x > mu) {
              assert(equal(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4), 1))
            } else {
              assert(equal(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4), 1))
            }
          }, LAPS)
        })
      })

      describe('P', () => {
        it('should satisfy the recurrence relation', () => {
          repeat(() => {
            const x = Math.random() * 30
            const y = 10 + Math.random() * 10
            const mu = 30 + Math.random() * 5

            const q1 = special.marcumQ(mu + 1, x, y)
            const q2 = special.marcumQ(mu, x, y)
            const q3 = special.marcumQ(mu + 2, x, y)
            const q4 = special.marcumQ(mu - 1, x, y)

            if (x > mu) {
              assert(equal(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4), 1))
            } else {
              assert(equal(((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4), 1))
            }
          }, LAPS)
        })
      })

      it('should match scipy ncx2 reference values', () => {
        [
          { mu: 4, x: 10, y: 20, p: 0.8840146502552253, q: 0.11598534974477473 },
          { mu: 2, x: 5, y: 3, p: 0.10329898661024607, q: 0.8967010133897539 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })
    })

    describe('asymptotic expansion for large xi', () => {
      describe('Q', () => {
        it('should satisfy the recurrence relation', () => {
          repeat(() => {
            const x = 35 + Math.random() * 100
            const y = x + 20 + Math.random() * 100
            const mu = 3 + Math.random() * 3

            const q1 = special.marcumQ(mu + 1, x, y)
            const q2 = special.marcumQ(mu, x, y)
            const q3 = special.marcumQ(mu + 2, x, y)
            const q4 = special.marcumQ(mu - 1, x, y)

            assert(equal(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4), 1))
          }, LAPS)
        })
      })

      describe('P', () => {
        it('should satisfy the recurrence relation', () => {
          repeat(() => {
            const x = 45 + Math.random() * 90
            const y = x - 5 - Math.random() * 25
            const mu = 3 + Math.random() * 3

            const q1 = special.marcumQ(mu + 1, x, y)
            const q2 = special.marcumQ(mu, x, y)
            const q3 = special.marcumQ(mu + 2, x, y)
            const q4 = special.marcumQ(mu - 1, x, y)

            assert(equal(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4), 1))
          }, LAPS)
        })
      })

      it('should match scipy ncx2 reference values', () => {
        [
          { mu: 5, x: 40, y: 60, q: 0.05987990370344369, p: 0.9401200962965562 },
          { mu: 3, x: 120, y: 150, q: 0.04687422045974286, p: 0.9531257795402576 },
          { mu: 10, x: 70, y: 45, q: 0.9994063950877903, p: 0.0005936049122101624 },
          { mu: 3, x: 46, y: 5, q: 0.9999999999966671, p: 3.3330073779888013e-12 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })
    })

    describe('quadrature', () => {
      it('should satisfy the recurrence relation', () => {
        repeat(() => {
          const x = 40 + Math.random() * 40
          const y = 0.5 + Math.random() * 1.5
          const mu = 3 + Math.random() * 5

          const q1 = special.marcumQ(mu + 1, x, y)
          const q2 = special.marcumQ(mu, x, y)
          const q3 = special.marcumQ(mu + 2, x, y)
          const q4 = special.marcumQ(mu - 1, x, y)

          assert(equal(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4), 1))
        }, LAPS)
      })

      it('should match scipy ncx2 reference values', () => {
        [
          { mu: 140, x: 100, y: 235, p: 0.4015210444334114, q: 0.5984789555665886 },
          { mu: 140, x: 100, y: 200, p: 0.011694400751604403, q: 0.9883055992483956 },
          { mu: 60, x: 200, y: 400, p: 0.9999999966690462, q: 3.3309538428122277e-9 },
          { mu: 5, x: 50, y: 4, p: 7.677483509552288e-16, q: 0.9999999999999992 },
          { mu: 8, x: 60, y: 3, p: 3.3894189213527325e-23, q: 1.0 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })
    })

    describe('recurrence relation', () => {
      const check = (x, y, mu) => {
        const q1 = special.marcumQ(mu + 1, x, y)
        const q2 = special.marcumQ(mu, x, y)
        const q3 = special.marcumQ(mu + 2, x, y)
        const q4 = special.marcumQ(mu - 1, x, y)
        const r = x > mu
          ? ((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4)
          : ((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4)
        assert(equal(r, 1))
      }

      it('should satisfy the recurrence relation', () => {
        // Both x < mu and x > mu inside the transition band, exercising both
        // forms of the recurrence test.
        repeat(() => {
          const x = 40 + Math.random() * 30
          const mu = 80 + Math.random() * 40
          const s = Math.sqrt(4 * x + 2 * mu)
          check(x, x + mu - 0.8 * s + Math.random() * 1.6 * s, mu)
        }, LAPS)
        repeat(() => {
          const x = 80 + Math.random() * 60
          const mu = 40 + Math.random() * 30
          const s = Math.sqrt(4 * x + 2 * mu)
          check(x, x + mu - 0.8 * s + Math.random() * 1.6 * s, mu)
        }, LAPS)
      })

      it('should match scipy ncx2 reference values', () => {
        [
          { mu: 100, x: 50, y: 150, p: 0.5117578749745552, q: 0.48824212502544484 },
          { mu: 90, x: 60, y: 140, p: 0.2499150811158282, q: 0.7500849188841718 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })
    })

    describe('large mu asymptotic', () => {
      const check = (x, y, mu) => {
        const q1 = special.marcumQ(mu + 1, x, y)
        const q2 = special.marcumQ(mu, x, y)
        const q3 = special.marcumQ(mu + 2, x, y)
        const q4 = special.marcumQ(mu - 1, x, y)
        const r = x > mu
          ? ((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4)
          : ((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4)
        assert(equal(r, 1))
      }

      it('should satisfy the recurrence relation', () => {
        // mu >= 135 is the dispatch threshold; at the boundary the mu-1 order
        // may fall on the recurrence branch, but the three-term identity holds
        // across any mix of correct branches. Both x < mu and x > mu run.
        repeat(() => {
          const x = 30 + Math.random() * 50
          const mu = 135 + Math.random() * 115
          const s = Math.sqrt(4 * x + 2 * mu)
          check(x, x + mu - 0.9 * s + Math.random() * 1.8 * s, mu)
        }, LAPS)
        repeat(() => {
          const mu = 135 + Math.random() * 65
          const x = mu + 20 + Math.random() * 80
          const s = Math.sqrt(4 * x + 2 * mu)
          check(x, x + mu - 0.9 * s + Math.random() * 1.8 * s, mu)
        }, LAPS)
      })

      it('should match scipy ncx2 reference values', () => {
        [
          { mu: 135, x: 40, y: 170, p: 0.3755801225650498, q: 0.6244198774349506 },
          { mu: 135, x: 44, y: 188, p: 0.7323059732316725, q: 0.26769402676832693 },
          { mu: 150, x: 60, y: 205, p: 0.38907639626893925, q: 0.6109236037310609 },
          { mu: 200, x: 55, y: 248, p: 0.35242643120412376, q: 0.6475735687958762 },
          { mu: 160, x: 70, y: 250, p: 0.8745123498463065, q: 0.1254876501536935 },
          { mu: 180, x: 50, y: 230, p: 0.5093676830927159, q: 0.49063231690728504 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })
    })
  })

  describe('.marcumP()', () => {
    describe('special cases', () => {
      it('should return 0 for y = 0', () => {
        repeat(() => {
          assert(special.marcumP(2 + Math.random() * 5, Math.random() * 30, 0) === 0)
        }, LAPS)
      })

      it('should equal the lower incomplete gamma for x = 0', () => {
        repeat(() => {
          const y = 40 + Math.random() * 60
          const mu = 2 + Math.random() * 5
          assert(equal(special.marcumP(mu, 0, y), special.gammaLowerIncomplete(mu, y)))
        }, LAPS)
      })
    })

    it('should satisfy the recurrence relation', () => {
      const check = (x, y, mu) => {
        const p1 = special.marcumP(mu + 1, x, y)
        const p2 = special.marcumP(mu, x, y)
        const p3 = special.marcumP(mu + 2, x, y)
        const p4 = special.marcumP(mu - 1, x, y)
        const r = x > mu
          ? ((x - mu) * p1 + (y + mu) * p2) / (x * p3 + y * p4)
          : ((y + mu) * p2) / (x * p3 + (mu - x) * p1 + y * p4)
        assert(equal(r, 1))
      }
      // Series, asymptotic, quadrature, recurrence and large-mu regimes. The
      // quadrature and recurrence points stay close enough to the transition
      // that P is above the underflow limit, so the relation is meaningfully
      // exercised.
      repeat(() => check(Math.random() * 30, 10 + Math.random() * 10, 30 + Math.random() * 5), LAPS)
      repeat(() => {
        const x = 45 + Math.random() * 90
        check(x, x - 5 - Math.random() * 25, 3 + Math.random() * 3)
      }, LAPS)
      repeat(() => {
        const x = 40 + Math.random() * 30
        const mu = 80 + Math.random() * 40
        const s = Math.sqrt(4 * x + 2 * mu)
        check(x, x + mu - 1.7 * s + Math.random() * 0.6 * s, mu)
      }, LAPS)
      repeat(() => {
        const x = 40 + Math.random() * 30
        const mu = 80 + Math.random() * 40
        const s = Math.sqrt(4 * x + 2 * mu)
        check(x, x + mu - 0.8 * s + Math.random() * 1.6 * s, mu)
      }, LAPS)
      repeat(() => {
        const x = 30 + Math.random() * 50
        const mu = 135 + Math.random() * 110
        const s = Math.sqrt(4 * x + 2 * mu)
        check(x, x + mu - 0.9 * s + Math.random() * 1.8 * s, mu)
      }, LAPS)
    })
  })

  describe('marcumQ and marcumP', () => {
    it('should satisfy marcumQ + marcumP = 1 across all branches', () => {
      const identity = (x, y, mu) => {
        assert(equal(special.marcumQ(mu, x, y) + special.marcumP(mu, x, y), 1))
      }
      // Series, asymptotic, quadrature, recurrence and large-mu regimes.
      repeat(() => identity(Math.random() * 30, 40 + Math.random() * 60, 2 + Math.random() * 5), LAPS)
      repeat(() => {
        const x = 35 + Math.random() * 100
        identity(x, x + 20 + Math.random() * 100, 3 + Math.random() * 3)
      }, LAPS)
      repeat(() => identity(40 + Math.random() * 40, 0.5 + Math.random() * 1.5, 3 + Math.random() * 5), LAPS)
      repeat(() => {
        const x = 40 + Math.random() * 30
        const mu = 80 + Math.random() * 40
        const s = Math.sqrt(4 * x + 2 * mu)
        identity(x, x + mu - 0.8 * s + Math.random() * 1.6 * s, mu)
      }, LAPS)
      repeat(() => {
        const x = 30 + Math.random() * 50
        const mu = 140 + Math.random() * 100
        const s = Math.sqrt(4 * x + 2 * mu)
        identity(x, x + mu - 0.8 * s + Math.random() * 1.6 * s, mu)
      }, LAPS)
    })
  })

  describe('.owenT()', () => {
    it('should return reference values', () => {
      [
        { h: 0.0625, a: 0.25, t: 0.03891193023470137 },
        { h: 6.5, a: 0.4375, t: 2.0005773048508314e-11 },
        { h: 7, a: 0.96875, t: 6.399062719389869e-13 },
        { h: 4.78125, a: 0.0625, t: 1.0632974804687463e-7 },
        { h: 2, a: 0.5, t: 0.008625077985521507 },
        { h: 1, a: 0.9999975, t: 0.0667418089782286 },
        { h: 1, a: 0.5, t: 0.04306469112078537 },
        { h: 1, a: 1, t: 0.06674188216570097 },
        { h: 1, a: 2, t: 0.0784681869930841 },
        { h: 1, a: 3, t: 0.0792995047488726 },
        { h: 0.5, a: 0.5, t: 0.06448860284750375 },
        { h: 0.5, a: 1, t: 0.1066710629614485 },
        { h: 0.5, a: 2, t: 0.1415806036539784 },
        { h: 0.5, a: 3, t: 0.1510840430760184 },
        { h: 0.25, a: 0.5, t: 0.07134663382271778 },
        { h: 0.25, a: 1, t: 0.1201285306350883 },
        { h: 0.25, a: 2, t: 0.1666128410939293 },
        { h: 0.25, a: 3, t: 0.1847501847929859 },
        { h: 0.125, a: 0.5, t: 0.07317273327500386 },
        { h: 0.125, a: 1, t: 0.1237630544953746 },
        { h: 0.125, a: 2, t: 0.1737438887583106 },
        { h: 0.125, a: 3, t: 0.1951190307092811 },
        { h: 0.0078125, a: 0.5, t: 0.07378938035365545 },
        { h: 0.0078125, a: 1, t: 0.1249951430754052 },
        { h: 0.0078125, a: 2, t: 0.1761984774738108 },
        { h: 0.0078125, a: 3, t: 0.1987772386442824 },
        { h: 0.0078125, a: 10, t: 0.2340886964802671 },
        { h: 0.0078125, a: 100, t: 0.2479460829231492 }
      ].forEach(d => {
        assert(equal(special.owenT(d.h, d.a), d.t))
      })
    })

    it('should return reference values at sector boundaries with 14 significant digits', () => {
      [
        { h: 0.5, a: 0.025, t: 0.003510520947201143 },
        { h: 0.5, a: 0.09, t: 0.012602627267934824 },
        { h: 0.5, a: 0.15, t: 0.02089267814596295 },
        { h: 0.5, a: 0.36, t: 0.04828218926612005 },
        { h: 0.5, a: 0.5, t: 0.06448860284750375 },
        { h: 0.5, a: 0.9, t: 0.10007270175061386 },
        { h: 0.5, a: 0.99999, t: 0.10667044320760354 },
        { h: 2.0, a: 0.025, t: 0.000538145641532743 },
        { h: 2.0, a: 0.09, t: 0.0019229592641905593 },
        { h: 2.0, a: 0.15, t: 0.0031597998016760784 },
        { h: 2.0, a: 0.36, t: 0.006865704986743918 },
        { h: 2.0, a: 0.5, t: 0.00862507798552151 },
        { h: 2.0, a: 0.9, t: 0.010928598829162459 },
        { h: 2.0, a: 0.99999, t: 0.011116267146773112 },
        { h: 0.02, a: 0.5, t: 0.07377589505496221 },
        { h: 0.06, a: 0.5, t: 0.07364870894373357 },
        { h: 0.09, a: 0.5, t: 0.07347022604865686 },
        { h: 0.125, a: 0.5, t: 0.07317273327500384 },
        { h: 0.26, a: 0.5, t: 0.07115073619192525 },
        { h: 0.4, a: 0.5, t: 0.06769364453308699 },
        { h: 0.6, a: 0.5, t: 0.06077755812641674 },
        { h: 1.6, a: 0.5, t: 0.01863684908269017 },
        { h: 1.7, a: 0.5, t: 0.015616899411410147 },
        { h: 2.33, a: 0.5, t: 0.004025149112463264 },
        { h: 2.4, a: 0.5, t: 0.0033746756355782564 },
        { h: 3.36, a: 0.5, t: 0.00018077433066393216 },
        { h: 3.4, a: 0.5, t: 0.0001567864305170142 },
        { h: 4.8, a: 0.5, t: 3.915533232636861e-7 }
      ].forEach(d => {
        assert(equal(special.owenT(d.h, d.a), d.t, 14), `owenT(${d.h}, ${d.a})`)
      })
    })

    it('should be continuous across sector boundaries', () => {
      const eps = 1e-9
      const aBoundaries = [
        { h: 0.5, a: 0.025 },
        { h: 0.5, a: 0.09 },
        { h: 0.5, a: 0.15 },
        { h: 0.5, a: 0.36 },
        { h: 0.5, a: 0.5 },
        { h: 0.5, a: 0.9 },
        { h: 0.5, a: 0.99999 }
      ]
      aBoundaries.forEach(({ h, a }) => {
        assert(equal(special.owenT(h, a), special.owenT(h, a * (1 + eps)), 8),
          `owenT(${h}, ${a}) a-boundary continuity`)
      })
      const hBoundaries = [
        { h: 0.02, a: 0.5 },
        { h: 0.06, a: 0.5 },
        { h: 0.09, a: 0.5 },
        { h: 0.125, a: 0.5 },
        { h: 0.26, a: 0.5 },
        { h: 0.4, a: 0.5 },
        { h: 0.6, a: 0.5 },
        { h: 1.6, a: 0.5 },
        { h: 1.7, a: 0.5 },
        { h: 2.33, a: 0.5 },
        { h: 2.4, a: 0.5 },
        { h: 3.36, a: 0.5 },
        { h: 3.4, a: 0.5 },
        { h: 4.8, a: 0.5 }
      ]
      hBoundaries.forEach(({ h, a }) => {
        assert(equal(special.owenT(h, a), special.owenT(h * (1 + eps), a), 7),
          `owenT(${h}, ${a}) h-boundary continuity`)
      })
    })
  })

  describe('.erf()', () => {
    it('should return reference values', () => {
      assert(special.erf(0) === 0)
      ;[
        { x: 0.5, y: 0.5204998778130465 },
        { x: 1.0, y: 0.8427007929497149 },
        { x: 1.5, y: 0.9661051464753108 },
        { x: 2.0, y: 0.9953222650189527 },
        { x: 3.0, y: 0.9999779095030014 },
        { x: 5.0, y: 0.9999999999984626 }
      ].forEach(d => {
        assert(equal(special.erf(d.x), d.y), `erf(${d.x})`)
      })
    })

    it('should satisfy erf(-x) = -erf(x)', () => {
      [0.5, 2, 5].forEach(x => {
        assert(equal(special.erf(-x), -special.erf(x)), `erf(-${x})`)
      })
    })
  })

  describe('.erfc()', () => {
    it('should return reference values', () => {
      assert(special.erfc(0) === 1)
      ;[
        { x: 0.5, y: 0.4795001221869535 },
        { x: 1.0, y: 0.1572992070502851 },
        { x: 2.0, y: 0.004677734981047265 },
        { x: 3.0, y: 2.209049699858544e-5 },
        { x: 5.0, y: 1.537459794428035e-12 },
        { x: 10.0, y: 2.08848758376254e-45 }
      ].forEach(d => {
        assert(equal(special.erfc(d.x), d.y), `erfc(${d.x})`)
      })
    })

    it('should return 0 for large positive x', () => {
      assert(special.erfc(27) === 0)
    })

    it('should satisfy erfc(-x) = 2 - erfc(x)', () => {
      [0.5, 2, 5].forEach(x => {
        assert(equal(special.erfc(-x), 2 - special.erfc(x)), `erfc(-${x})`)
      })
    })

    it('should maintain relative precision in the far tail', () => {
      // erfc(7/sqrt(2)) appears in Normal(0,2).cdf(14); CF branch must give full precision
      assert(equal(special.erfc(7 / Math.SQRT2), 2.559625087771669924e-12), 'erfc(7/sqrt(2))')
    })
  })

  describe('.erfinv()', () => {
    it('should return zero for zero argument', () => {
      assert(special.erfinv(0) === 0)
    })

    it('should be the inverse of erf', () => {
      [-0.9, -0.5, -0.1, 0.1, 0.5, 0.9].forEach(x => {
        assert(equal(special.erf(special.erfinv(x)), x), `erfinv(${x})`)
      })
    })

    it('should satisfy erfinv(-x) = -erfinv(x)', () => {
      [0.1, 0.5, 0.9].forEach(x => {
        assert(equal(special.erfinv(-x), -special.erfinv(x)), `erfinv(-${x})`)
      })
    })

    it('should be accurate at small arguments where Newton iterates near zero', () => {
      // Newton stopping criterion must handle x near 0; hybrid |dx| < EPS*max(|x|,1) is correct
      [1e-5, 1e-8, 1e-10].forEach(x => {
        assert(equal(special.erf(special.erfinv(x)), x), `erfinv(${x})`)
      })
    })

    it('should be accurate at subnormal-range arguments (x^2 underflows to 0)', () => {
      // For x ~ 1e-300, x^2 underflows to 0 so the polynomial initial guess collapses to x itself.
      // Newton converges in one step because erf is linear at this scale; the hybrid stopping
      // criterion must not exit prematurely before that step is taken.
      assert(equal(special.erf(special.erfinv(1e-300)), 1e-300), 'erfinv(1e-300)')
    })
  })
})
