import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.bessel', () => {
  describe('.bessel()', () => {
    it('In(0) should be equal to 0 for n >= 1', () => {
      for (const n of [1, 2, 3, 5, 10]) {
        assert(special.besselI(n, 0) === 0)
      }
    })

    it('I1(-x) should be equal to -I1(x)', () => {
      for (const x of [0.1, 1, 9.9, 10, 10.1, 50]) {
        assert(equal(special.besselI(1, -x), -special.besselI(1, x)))
      }
    })

    it('In(-x) should be equal to -In(x) for odd n >= 3', () => {
      // Regression for the backward-recurrence sign bug fixed in #255: abs(x) with no sign
      // correction caused I_n(-x) != -I_n(x) for odd n >= 3
      for (const x of [0.1, 1, 5, 9.9, 10, 10.1, 50]) {
        assert(equal(special.besselI(3, -x), -special.besselI(3, x)))
        assert(equal(special.besselI(5, -x), -special.besselI(5, x)))
        assert(equal(special.besselI(7, -x), -special.besselI(7, x)))
      }
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
      // mpmath mp.dps=50: besseli(0, mpf(10.1)) -> 3095.9756707889824
      assert(equal(special.besselI(0, 10.1), 3095.9756707889824))
    })

    it('I0(x) should match mpmath reference values in the Miller warm-up band (10, 15]', () => {
      // Issue #1185: _besselIBackward's j_max margin term degenerates to 0 at n=0
      // (sqrt(40*0)=0), leaving a ~1e-9 relative-error precision gap in this band.
      // mpmath mp.dps=50: besseli(0, mpf(x))
      assert(equal(special.besselI(0, 10.5), 4527.441714638888, 14))
      assert(equal(special.besselI(0, 11), 7288.489339821248, 14))
      assert(equal(special.besselI(0, 12), 18948.925349296307, 14))
      assert(equal(special.besselI(0, 13), 49444.489582217575, 14))
      assert(equal(special.besselI(0, 14), 129418.56270064856, 14))
    })
  })

  describe('.besselISpherical()', () => {
    it('i(0, 0) should be 1', () => {
      assert(special.besselISpherical(0, 0) === 1)
    })

    it('i(1, 0) should be 0', () => {
      assert(special.besselISpherical(1, 0) === 0)
    })

    it('i(n, 0) should be 0 for n > 0', () => {
      for (const n of [1, 2, 5]) {
        assert(special.besselISpherical(n, 0) === 0)
      }
    })

    it('should satisfy the recurrence relation for negative order', () => {
      for (const n of [-1, -2, -3, -5]) {
        for (const x of [0.5, 2, 9, 11]) {
          assert(equal(special.besselISpherical(n - 1, x) - special.besselISpherical(n + 1, x),
            (2 * n + 1) * special.besselISpherical(n, x) / x))
        }
      }
    })

    it('should satisfy the recurrence relation for positive order', () => {
      for (const n of [1, 2, 3, 5]) {
        for (const x of [0.5, 2, 9, 11]) {
          assert(equal(special.besselISpherical(n - 1, x) - special.besselISpherical(n + 1, x),
            (2 * n + 1) * special.besselISpherical(n, x) / x))
        }
      }
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
      for (const n of [1, 2, 5]) {
        for (const x of [0.01, 0.1, 0.5, 0.99]) {
          assert(equal(special.besselISpherical(n - 1, x) - special.besselISpherical(n + 1, x),
            (2 * n + 1) * special.besselISpherical(n, x) / x))
        }
      }
    })

    it('should return accurate large-argument values', () => {
      // i_n(x) = sqrt(pi/(2x)) * I_{n+1/2}(x); mpmath mp.dps=50:
      // i_3(50) = 4.5930269336647156e+19, i_3(100) = 1.2654109836313822e+41
      // i_7(50) = 2.947924492475899e+19, i_7(100) = 1.0145184556029379e+41
      assert(equal(special.besselISpherical(3, 50), 4.5930269336647156e+19, 10))
      assert(equal(special.besselISpherical(3, 100), 1.2654109836313822e+41, 10))
      assert(equal(special.besselISpherical(7, 50), 2.947924492475899e+19, 10))
      assert(equal(special.besselISpherical(7, 100), 1.0145184556029379e+41, 10))
    })

    it('should return accurate values past _hi\'s pre-#1311 fixed MAX_ITER=100 budget (#1311)', () => {
      // 7*sqrt(x)+20 only exceeds MAX_ITER=100 once x > ~131 (e.g. it's still only 90 at
      // x=100), so x=300 and x=500 are chosen to land past that crossover -- and past the
      // x~250 point where the pre-#1311 fixed budget silently under-converged (CHANGELOG) --
      // unlike x=50/100 above, which pass under the old, un-widened budget too.
      // i_n(x) = sqrt(pi/(2x)) * I_{n+1/2}(x); mpmath mp.dps=50, rounded to float64:
      // i_3(300) = 3.1731675432386596e+127, i_3(500) = 1.3868331583406083e+214
      // i_7(300) = 2.9484482410057756e+127, i_7(500) = 1.3270783008491142e+214
      assert(equal(special.besselISpherical(3, 300), 3.1731675432386596e+127, 10))
      assert(equal(special.besselISpherical(3, 500), 1.3868331583406083e+214, 10))
      assert(equal(special.besselISpherical(7, 300), 2.9484482410057756e+127, 10))
      assert(equal(special.besselISpherical(7, 500), 1.3270783008491142e+214, 10))
    })

    // _assertHiConverged's throw was probed empirically across n in [1, 1e6] and x in
    // [1e-10, 709] (the exp(x) overflow ceiling for the unscaled function) through both
    // besselISpherical and besselISphericalExpScaled -- including large n relative to x, per
    // the "depth grows with x, not n" claim in _hi's comment -- and never fired: 7*sqrt(x)+20
    // keeps a comfortable margin over actual convergence depth throughout the whole domain
    // besselISpherical's Wronskian branch is reached from. The check remains defensive: it
    // guards the 7*sqrt(x)+20 margin against being falsified by a future change, not a path
    // this test suite can currently force through valid input.

    it('should satisfy the parity identity i_n(-x) = (-1)^n * i_n(x) for n > 1 (#1324)', () => {
      // i_n(x) is an entire function of x -- its Taylor series has only x^(n+2k) terms --
      // so it has definite parity (-1)^n. In the Taylor branch (|x| < 1), negative x is
      // computed through the *same* series (no separate code path), so cross-checking it
      // against the positive-x call is a genuine consistency test, not a tautology.
      for (const n of [2, 3, 5, 7]) {
        for (const x of [0.1, 0.5]) {
          assert(equal(special.besselISpherical(n, -x), (n % 2 === 0 ? 1 : -1) * special.besselISpherical(n, x)))
        }
      }
      // mpmath mp.dps=50: i_n(x) = sqrt(pi/(2x)) * I_{n+1/2}(x); i_2(0.5) = 0.01696636036086198
      assert(equal(special.besselISpherical(2, -0.5), 0.01696636036086198))

      // The Wronskian/_hi branch (|x| >= 1) is where #1324's bug actually lived: _hi(n, x)
      // computed Math.sqrt(x) directly on the unmapped negative x, turning its iteration
      // budget into NaN. besselISpherical(n, -x) maps internally to (-1)^n * besselISpherical(n, x),
      // so asserting against that same formula would be tautological -- it would pass even if
      // the underlying _hi/_kn computation were wrong. These are independently sourced from
      // mpmath mp.dps=50 via i_n(x) = sqrt(pi/(2x)) * I_{n+1/2}(x), never derived from ranjs:
      // i_2(2) = 0.3518560885534178, i_3(2) = 0.09474252219651647, i_7(2) = 7.097944523040642e-05
      // i_2(9) = 316.7872223410896, i_5(9) = 81.7183759470097
      assert(equal(special.besselISpherical(2, -2), 0.3518560885534178))
      assert(equal(special.besselISpherical(3, -2), -0.09474252219651647))
      assert(equal(special.besselISpherical(7, -2), -7.097944523040642e-05))
      assert(equal(special.besselISpherical(2, -9), 316.7872223410896))
      assert(equal(special.besselISpherical(5, -9), -81.7183759470097))
      // mpmath mp.dps=50, negated per the parity identity (n odd, matching the "should return
      // accurate large-argument values" test's i_3(50)/i_7(50) above): i_3(50) = 4.5930269336647156e+19
      // -> i_3(-50) = -4.5930269336647156e+19; i_7(50) = 2.947924492475899e+19 -> i_7(-50) = -2.947924492475899e+19
      assert(equal(special.besselISpherical(3, -50), -4.5930269336647156e+19, 10))
      assert(equal(special.besselISpherical(7, -50), -2.947924492475899e+19, 10))
    })
  })

  // Issue #1310: besselIExpScaled (added by #1292) was previously only reachable indirectly
  // through NoncentralChi2/NoncentralChi pdf evaluation at a handful of large-lambda*x points,
  // leaving its own branch structure (n=0 small-x/large-x split, x=0, negative-x sign flip)
  // without any dedicated coverage.
  describe('.besselIExpScaled()', () => {
    it('should return exactly 0 at x=0 for n >= 1', () => {
      for (const n of [1, 2, 3, 5]) {
        assert(special.besselIExpScaled(n, 0) === 0)
      }
    })

    it('should return 1 at n=0, x=0', () => {
      // _I0(0) * exp(-0) = 1 * 1 = 1
      assert(special.besselIExpScaled(0, 0) === 1)
    })

    it('should return accurate values in the n=0 small-x _I0 branch (|x| <= 10)', () => {
      // mpmath mp.dps=50: besseli(0, mpf(x)) * exp(-mpf(x)). Deliberately not checked via
      // besselI(0, x) * Math.exp(-x): both besselI and besselIExpScaled call the exact same
      // _I0(x) helper in this branch, so that identity would hold even if _I0 itself were wrong.
      assert(equal(special.besselIExpScaled(0, 0.001), 0.9990007495835156, 13))
      assert(equal(special.besselIExpScaled(0, 0.5), 0.6450352704491501, 13))
      assert(equal(special.besselIExpScaled(0, 1), 0.46575960759364043, 13))
      assert(equal(special.besselIExpScaled(0, 5), 0.18354081260932836, 13))
      assert(equal(special.besselIExpScaled(0, 9.9), 0.1284955220071385, 13))
      assert(equal(special.besselIExpScaled(0, 10), 0.1278333371634286, 13))
    })

    it('should return accurate values in the n=0 large-x _besselIBackward branch (|x| > 10)', () => {
      // mpmath mp.dps=50: besseli(0, mpf(x)) * exp(-mpf(x)). Not checked via besselI(0, x) *
      // Math.exp(-x): both share _besselIBackward's Miller-recurrence loop, differing only in
      // the final scaled ? y/sum : y*exp(x-log(sum)) line, so a bug in the shared loop would
      // still satisfy that identity.
      assert(equal(special.besselIExpScaled(0, 10.1), 0.12718130354436347, 13))
      assert(equal(special.besselIExpScaled(0, 14), 0.10761525167069509, 13))
      assert(equal(special.besselIExpScaled(0, 50), 0.05656162664745419, 13))
      assert(equal(special.besselIExpScaled(0, 200), 0.028227159949111916, 13))
      assert(equal(special.besselIExpScaled(0, 700), 0.015081295651531358, 13))
    })

    it('should be continuous across the |x|=10 n=0 routing boundary', () => {
      // mpmath mp.dps=50: besseli(0, mpf(x)) * exp(-mpf(x))
      assert(equal(special.besselIExpScaled(0, 9.9), 0.1284955220071385, 13))
      assert(equal(special.besselIExpScaled(0, 10), 0.1278333371634286, 13))
      assert(equal(special.besselIExpScaled(0, 10.1), 0.12718130354436347, 13))
    })

    it('should return accurate values for n != 0 across the _besselIBackward crossover', () => {
      // mpmath mp.dps=50: besseli(n, mpf(x)) * exp(-mpf(x)). Not checked via besselI(n, x) *
      // Math.exp(-x): both share the same _besselIBackward Miller-recurrence loop for any given
      // (n, x), so that identity cannot catch a bug in the shared loop itself (only in the
      // scaled=true/false post-processing, which is a single line).
      assert(equal(special.besselIExpScaled(1, 0.5), 0.1564208031848717, 13))
      assert(equal(special.besselIExpScaled(1, 9.9), 0.12182203639796144, 13))
      assert(equal(special.besselIExpScaled(1, 10.1), 0.12071085823848707, 13))
      assert(equal(special.besselIExpScaled(1, 100), 0.03974415302513025, 13))
      assert(equal(special.besselIExpScaled(1, 500), 0.017827851852898056, 13))
      assert(equal(special.besselIExpScaled(2, 0.5), 0.01935205770966328, 13))
      assert(equal(special.besselIExpScaled(2, 9.9), 0.10388500960350994, 13))
      assert(equal(special.besselIExpScaled(2, 10.1), 0.1032781632991185, 13))
      assert(equal(special.besselIExpScaled(5, 0.5), 4.987605521470164e-06, 13))
      assert(equal(special.besselIExpScaled(5, 9.9), 0.03500619134149665, 13))
      assert(equal(special.besselIExpScaled(5, 10.1), 0.03555744332660292, 13))
      assert(equal(special.besselIExpScaled(10, 0.5), 1.6030859629529217e-13, 10))
      assert(equal(special.besselIExpScaled(10, 9.9), 0.0009555334260008234, 13))
      assert(equal(special.besselIExpScaled(10, 10.1), 0.0010330372238920365, 13))
      assert(equal(special.besselIExpScaled(10, 500), 0.016145898955259176, 13))
    })

    it('should stay finite well past besselI\'s own ~709 overflow ceiling', () => {
      // besselI(0, 1000) overflows to Infinity; the whole reason besselIExpScaled exists (#1292)
      // is to stay representable here. mpmath mp.dps=50: besseli(n, mpf(x)) * exp(-mpf(x))
      assert.strictEqual(special.besselI(0, 1000), Infinity)
      assert(equal(special.besselIExpScaled(0, 1000), 0.012617240455891257, 13))
      assert(equal(special.besselIExpScaled(3, 1000), 0.01256056218254712, 13))
      assert(equal(special.besselIExpScaled(0, 5000), 0.005642036898744589, 13))
      assert(equal(special.besselIExpScaled(3, 5000), 0.0056369608425911434, 13))
    })

    it('should satisfy sign symmetry for odd n at negative x', () => {
      for (const n of [1, 3, 5]) {
        for (const x of [0.1, 1, 5, 9.9, 10, 10.1, 50, 500]) {
          assert(equal(special.besselIExpScaled(n, -x), -special.besselIExpScaled(n, x)))
        }
      }
    })
  })

  // Issue #1321: besselIExpScaled(n, x) itself underflows to exactly 0 once the Bessel order n
  // is large relative to the argument x (e.g. n=999, x~63.25), because the true scaled value is
  // genuinely non-representable as a double there -- yet its logarithm is a normal finite
  // number. logBesselIExpScaled fills that gap: log(exp(-x) * I_n(x)), computed directly in
  // log-space so callers (Skellam._pdf) can combine it with other log-scale terms before a
  // single final exponentiation.
  describe('.logBesselIExpScaled()', () => {
    it('should return 0 at n=0, x=0', () => {
      assert(special.logBesselIExpScaled(0, 0) === 0)
    })

    it('should return -Infinity at x=0 for n >= 1', () => {
      for (const n of [1, 2, 3, 5]) {
        assert(special.logBesselIExpScaled(n, 0) === -Infinity)
      }
    })

    it('should agree with log(besselIExpScaled(n, x)) in the direct-delegation regime', () => {
      // mpmath mp.dps=50: log(besseli(n, mpf(x))) - x
      assert(equal(special.logBesselIExpScaled(0, 0.5), -0.4384502808145187, 12))
      assert(equal(special.logBesselIExpScaled(1, 0.5), -1.8552054470253345, 12))
      assert(equal(special.logBesselIExpScaled(5, 5), -4.230829927801479, 12))
      assert(equal(special.logBesselIExpScaled(10, 100), -3.722366634346062, 12))
      // Sanity: this regime is the one where besselIExpScaled already returns a nonzero value.
      assert(special.besselIExpScaled(10, 100) > 0)
    })

    it('should return a finite value in the large-order/small-argument regime where besselIExpScaled underflows to exactly 0', () => {
      // twoSqrtProd for Skellam(1000,1)/(2000,1)/(5000,1) -- the exact (n, x) pairs issue #1321
      // reports as NaN. Confirms the underflow precondition, then checks the finite log value.
      const z1 = 2 * Math.sqrt(1000)
      const z2 = 2 * Math.sqrt(2000)
      const z3 = 2 * Math.sqrt(5000)
      assert.strictEqual(special.besselIExpScaled(999, z1), 0)
      assert.strictEqual(special.besselIExpScaled(990, z1), 0)
      assert.strictEqual(special.besselIExpScaled(1999, z2), 0)
      assert.strictEqual(special.besselIExpScaled(4999, z3), 0)

      // mpmath mp.dps=50: log(besseli(n, mpf(x))) - x
      assert(equal(special.logBesselIExpScaled(999, z1), -2517.0427133980397, 12))
      assert(equal(special.logBesselIExpScaled(990, z1), -2485.9938897835273, 12))
      assert(equal(special.logBesselIExpScaled(1999, z2), -5690.264408550746, 12))
      assert(equal(special.logBesselIExpScaled(4999, z3), -16434.323389931138, 12))
      assert(equal(special.logBesselIExpScaled(100, 20), -152.4955121081758, 12))
    })
  })

  // Issue #1310: besselISphericalExpScaled (added by #1292) had the same coverage gap as
  // besselIExpScaled above -- only reachable indirectly through NoncentralChi/NoncentralChi2.
  describe('.besselISphericalExpScaled()', () => {
    it('should return 1 at n=0, x=0', () => {
      assert(special.besselISphericalExpScaled(0, 0) === 1)
    })

    it('should return exactly 0 at x=0 for n >= 1', () => {
      for (const n of [1, 2, 3, 5]) {
        assert(special.besselISphericalExpScaled(n, 0) === 0)
      }
    })

    it('should equal exp(-x) * besselISpherical(n, x) in the n=0 closed-form branch', () => {
      // (1 - exp(-2x)) / (2x) == exp(-x) * sinh(x) / x, checked against the unscaled function's
      // own independent code path.
      for (const x of [0.001, 0.5, 1, 5, 10, 50, 100, 500]) {
        assert(equal(special.besselISphericalExpScaled(0, x), special.besselISpherical(0, x) * Math.exp(-x)))
      }
    })

    it('should equal exp(-x) * besselISpherical(n, x) in the n=1 closed-form branch (|x| >= 1)', () => {
      // Legitimate cross-check: for |x| >= 1, besselISpherical(1, x) uses (cosh(x)-sinh(x)/x)/x
      // while besselISphericalExpScaled(1, x) uses the algebraically-equivalent but separately
      // coded (1+e^-2x)/(2x) - (1-e^-2x)/(2x^2) -- these are genuinely independent formulas,
      // unlike the |x| < 1 Taylor branch below (which shares _besselISphericalTaylor exactly).
      for (const x of [1, 1.01, 1.1, 2, 5, 50, 500]) {
        assert(equal(special.besselISphericalExpScaled(1, x), special.besselISpherical(1, x) * Math.exp(-x)))
      }
    })

    it('should return accurate small-x Taylor values for n=1 (|x| < 1)', () => {
      // mpmath mp.dps=50: sqrt(pi/(2x)) * besseli(1.5, x) * exp(-x). Not checked via
      // besselISpherical(1, x) * Math.exp(-x): both share the exact same
      // _besselISphericalTaylor(1, x) helper call in this branch.
      assert(equal(special.besselISphericalExpScaled(1, 1e-6), 3.3333300000019996e-07, 10))
      assert(equal(special.besselISphericalExpScaled(1, 1e-3), 0.00033300019991114283, 10))
      assert(equal(special.besselISphericalExpScaled(1, 0.1), 0.03019141928900223, 10))
      assert(equal(special.besselISphericalExpScaled(1, 0.5), 0.10363832351432696, 10))
      assert(equal(special.besselISphericalExpScaled(1, 0.9), 0.13214067137099655, 10))
      assert(equal(special.besselISphericalExpScaled(1, 0.99), 0.13506671882903618, 10))
    })

    it('should be continuous across the n=1 |x|=1 Taylor/closed-form crossover', () => {
      // mpmath mp.dps=50: sqrt(pi/(2x)) * besseli(1.5, x) * exp(-x)
      assert(equal(special.besselISphericalExpScaled(1, 0.99), 0.13506671882903618, 13))
      assert(equal(special.besselISphericalExpScaled(1, 1), 0.1353352832366127, 13))
      assert(equal(special.besselISphericalExpScaled(1, 1.01), 0.13559331673906708, 13))
    })

    it('should return accurate values in the n>=2 small-x Taylor branch (|x| < 1)', () => {
      // mpmath mp.dps=50: sqrt(pi/(2x)) * besseli(n+0.5, x) * exp(-x). Not checked via
      // besselISpherical(n, x) * Math.exp(-x): both share the exact same
      // _besselISphericalTaylor(n, x) helper call in this branch.
      assert(equal(special.besselISphericalExpScaled(2, 0.001), 6.660003807937037e-08, 10))
      assert(equal(special.besselISphericalExpScaled(2, 0.5), 0.01029061774259589, 10))
      assert(equal(special.besselISphericalExpScaled(2, 0.99), 0.026025479653984947, 10))
      assert(equal(special.besselISphericalExpScaled(3, 0.001), 9.514291003175277e-12, 10))
      assert(equal(special.besselISphericalExpScaled(3, 0.5), 0.0007321460883680679, 10))
      assert(equal(special.besselISphericalExpScaled(5, 0.001), 9.610394788422048e-20, 10))
      assert(equal(special.besselISphericalExpScaled(5, 0.5), 1.8409903951734993e-06, 10))
    })

    it('should return accurate values in the n>=2 Wronskian branch (|x| >= 1)', () => {
      // mpmath mp.dps=50: sqrt(pi/(2x)) * besseli(n+0.5, x) * exp(-x). Not checked via
      // besselISpherical(n, x) * Math.exp(-x): both derive from the same _hi(n+1, x) and
      // _knRaw(n+1, x) calls, differing only in whether the exp(-x)/x normalization _kn applies
      // is included -- a bug in the shared _hi/_knRaw recurrences would still satisfy that
      // identity.
      assert(equal(special.besselISphericalExpScaled(2, 1.01), 0.026626056675978112, 10))
      assert(equal(special.besselISphericalExpScaled(2, 2), 0.04761854340290348, 10))
      assert(equal(special.besselISphericalExpScaled(2, 10), 0.036499999862933286, 10))
      assert(equal(special.besselISphericalExpScaled(2, 500), 0.000994012, 13))
      assert(equal(special.besselISphericalExpScaled(3, 1.01), 0.0037811549767991933, 10))
      assert(equal(special.besselISphericalExpScaled(3, 10), 0.026750000181896806, 10))
      assert(equal(special.besselISphericalExpScaled(3, 500), 0.00098805988, 13))
      assert(equal(special.besselISphericalExpScaled(5, 1.01), 3.829481966569938e-05, 10))
      assert(equal(special.besselISphericalExpScaled(5, 10), 0.01075250041985184, 10))
      assert(equal(special.besselISphericalExpScaled(5, 500), 0.00097041665508976, 13))
    })

    it('should stay finite well past besselISpherical\'s own overflow ceiling', () => {
      // mpmath mp.dps=50: sqrt(pi/(2x)) * besseli(3.5, x) * exp(-x)
      assert(equal(special.besselISphericalExpScaled(3, 700), 0.0007081850999583507, 12))
      assert(equal(special.besselISphericalExpScaled(3, 5000), 9.9880059988e-05, 12))
    })

    it('should return accurate values in the n<0 backward-recurrence branch', () => {
      // mpmath mp.dps=50: sqrt(pi/(2x)) * besseli(n+0.5, x) * exp(-x). besselISphericalExpScaled
      // has no independent closed form for n < 0 -- the production code's own recursion IS the
      // implementation, and a recurrence-relation identity check against that same recursion
      // (as besselISpherical's own negative-order test above does) would be tautological here:
      // it's an algebraic rearrangement of the exact recursion being tested, so it can't catch a
      // bug in the recursion's own coefficients. These literals are the only independent check.
      assert(equal(special.besselISphericalExpScaled(-1, 0.5), 1.3678794411714423, 13))
      assert(equal(special.besselISphericalExpScaled(-1, 5), 0.10000453999297625, 13))
      assert(equal(special.besselISphericalExpScaled(-1, 50), 0.01, 13))
      assert(equal(special.besselISphericalExpScaled(-2, 0.5), -2.103638323514327, 13))
      assert(equal(special.besselISphericalExpScaled(-2, 5), 0.0799945520084285, 13))
      assert(equal(special.besselISphericalExpScaled(-2, 50), 0.0098, 13))
      assert(equal(special.besselISphericalExpScaled(-3, 0.5), 13.989709382257404, 13))
      assert(equal(special.besselISphericalExpScaled(-3, 5), 0.05200780878791915, 13))
      assert(equal(special.besselISphericalExpScaled(-3, 50), 0.009412, 13))
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

    it('should return finite values for very negative fractional order near the x~710 overflow boundary (issue #1215)', () => {
      // mpmath mp.dps=50: besseli(nu, x). Previously returned Infinity because the
      // recursiveSum accumulator overflowed before the tiny (x/2)^nu prefactor was applied.
      assert(equal(special.besselInu(-1.5, 709), 1.2295937306183464e+306, 13))
      assert(equal(special.besselInu(-2.5, 700), 1.5227751694938985e+302, 13))
      assert(equal(special.besselInu(-3.3, 710), 3.3197593551403374e+306, 13))
    })

    it('should handle the x=0 boundary for all three sign/order sub-cases', () => {
      // nu > 0: Math.pow(0, nu) = 0, gamma(nu+1) finite and positive => I_nu(0) = 0.
      assert.strictEqual(special.besselInu(2.3, 0), 0)

      // nu === 0: Math.pow(0, 0) === 1 (JS convention) and gamma(1) = 1 mathematically;
      // ranjs' gamma() is a floating-point approximation (not exactly 1 at x=1), so this
      // uses the tolerant `equal` helper rather than strictEqual.
      assert(equal(special.besselInu(0, 0), 1))

      // nu = -1.5 (non-integer, negative): gamma(-0.5) = -2*sqrt(pi) ~= -3.5449077018110322
      // (negative), and Math.pow(0, -1.5) is +Infinity per IEEE 754 (+0 raised to a negative
      // exponent), so the product +Infinity * (1 / negative) diverges to -Infinity.
      assert.strictEqual(special.besselInu(-1.5, 0), -Infinity)
    })
  })

  describe('.besselK()', () => {
    it('K_n(0) should be Infinity for all n', () => {
      // K_ν diverges at x=0 for all ν: ADR-0015 divergence → Infinity
      for (const n of [0, 1, 2, 3]) {
        assert.strictEqual(special.besselK(n, 0), Infinity)
      }
    })

    it('K_0(x) should match mpmath reference values', () => {
      // mpmath mp.dps=50: besselk(0, x) for x in {0.5, 1, 5, 10}
      // x=10 uses asymptotic; optimal-truncation error bound ~3.7e-10 limits to 9 sig figs there
      assert(equal(special.besselK(0, 0.5), 0.9244190712276659))
      assert(equal(special.besselK(0, 1), 0.42102443824070834))
      assert(equal(special.besselK(0, 5), 0.0036910983340425942))
      assert(equal(special.besselK(0, 10), 1.778006231616765e-05, 9))
    })

    it('K_1(x) should match mpmath reference values', () => {
      // mpmath mp.dps=50: besselk(1, x)
      // x=10 uses asymptotic; optimal-truncation error bound limits to 9 sig figs there
      assert(equal(special.besselK(1, 0.5), 1.656441120003301))
      assert(equal(special.besselK(1, 1), 0.6019072301972346))
      assert(equal(special.besselK(1, 5), 0.004044613445452165))
      assert(equal(special.besselK(1, 10), 1.8648773453825585e-05, 9))
    })

    it('K_n(x) should match mpmath reference values for n=2,3,4', () => {
      // mpmath mp.dps=50: besselk(n, x)
      assert(equal(special.besselK(2, 1), 1.6248388986351774))
      assert(equal(special.besselK(3, 1), 7.101262824737945))
      assert(equal(special.besselK(4, 1), 44.232415847062846))
      assert(equal(special.besselK(2, 5), 0.00530894371222346))
      assert(equal(special.besselK(3, 5), 0.008291768415230933))
    })

    it('K_0(x) should satisfy the asymptotic leading term at large x', () => {
      // K_ν(x) ~ sqrt(π/(2x)) * exp(-x) for large x; 1% tolerance at x=50
      const x = 50
      assert(Math.abs(special.besselK(0, x) * Math.exp(x) * Math.sqrt(2 * x / Math.PI) - 1) < 0.01)
    })

    it('should satisfy the recurrence K_{n+1}(x) = (2n/x)*K_n(x) + K_{n-1}(x)', () => {
      for (const [n, x] of [[1, 1], [2, 1], [1, 5], [2, 5]]) {
        const lhs = special.besselK(n + 1, x)
        const rhs = (2 * n / x) * special.besselK(n, x) + special.besselK(n - 1, x)
        assert(equal(lhs, rhs))
      }
    })

    it('K_0 and K_1 should be continuous across the series/asymptotic crossover at x=6', () => {
      // x≤6 uses combined series; x>6 uses asymptotic (_X_K_SERIES=6)
      // Over a 0.02 step the natural variation is ~2.2% (K decreases at ~1/unit near x=6)
      // A large discontinuity would produce a ratio outside [1, 1.1] or a sign flip
      const k0b = special.besselK(0, 5.99)
      const k0a = special.besselK(0, 6.01)
      const k1b = special.besselK(1, 5.99)
      const k1a = special.besselK(1, 6.01)
      assert(k0b > k0a && k0b / k0a < 1.1)
      assert(k1b > k1a && k1b / k1a < 1.1)
    })
  })

  describe('.besselKnu()', () => {
    it('K_nu(0) should be Infinity', () => {
      assert.strictEqual(special.besselKnu(0.5, 0), Infinity)
      assert.strictEqual(special.besselKnu(1.5, 0), Infinity)
    })

    it('K_{0.5}(x) should match the exact closed form sqrt(pi/(2x))*exp(-x)', () => {
      // K_{1/2}(x) = sqrt(pi/(2x)) * exp(-x) exactly (DLMF 10.39.2)
      for (const x of [1, 5, 10, 50]) {
        const exact = Math.sqrt(Math.PI / (2 * x)) * Math.exp(-x)
        assert(equal(special.besselKnu(0.5, x), exact))
      }
    })

    it('K_{1.5}(x) should match the exact closed form sqrt(pi/(2x))*exp(-x)*(1+1/x)', () => {
      // K_{3/2}(x) = sqrt(pi/(2x)) * exp(-x) * (1 + 1/x) exactly (DLMF 10.39.2)
      for (const x of [1, 5, 10, 50]) {
        const exact = Math.sqrt(Math.PI / (2 * x)) * Math.exp(-x) * (1 + 1 / x)
        assert(equal(special.besselKnu(1.5, x), exact))
      }
    })

    it('K_{2.5}(x) should match mpmath reference values', () => {
      // mpmath mp.dps=50: besselk(2.5, x)
      // x=10 uses asymptotic; for nu=2.5 the series terminates at k=3 (4nu²-25=0),
      // so the only error is floating-point rounding — precision=10 is correct here
      assert(equal(special.besselKnu(2.5, 1), 3.2274795311352618))
      assert(equal(special.besselKnu(2.5, 5), 0.006495775004385758))
      assert(equal(special.besselKnu(2.5, 10), 2.393132586462789e-05))
    })

    it('should dispatch to besselK for integer nu', () => {
      for (const x of [1, 5]) {
        assert.strictEqual(special.besselKnu(0, x), special.besselK(0, x))
        assert.strictEqual(special.besselKnu(1, x), special.besselK(1, x))
        assert.strictEqual(special.besselKnu(2, x), special.besselK(2, x))
      }
    })

    it('should dispatch negative-integer nu to the correct absolute order', () => {
      // K_ν is even in ν: K_{-n}(x) = K_n(x); negative-integer dispatch must abs() the order
      for (const x of [1, 5]) {
        assert.strictEqual(special.besselKnu(-1, x), special.besselK(1, x))
        assert.strictEqual(special.besselKnu(-2, x), special.besselK(2, x))
        assert.strictEqual(special.besselKnu(-3, x), special.besselK(3, x))
      }
    })

    it('should match mpmath at the exact issue #1361 point (nu comparable to x, just past the x=6 crossover)', () => {
      // mpmath mp.dps=50: besselk(4.82, 7.18) -> 0.001539804158137713
      // Previously returned ~0.000358 (the bare _KAsymptotic leading term, ~77% relative error)
      // because the unconditional x>6 dispatch to _KAsymptotic ignored how nu compared to x.
      // x=7.18 is just past the crossover, where _KAsymptotic's own optimal-truncation error
      // (not machine precision) is the limiting factor -- measured ~4.6e-9 relative error here,
      // the same mechanism precision-refs-special.py's "just past x=6 crossover" tolerance
      // bucket already documents for besselK/besselKnu (tol=2e-6 there); precision=8 gives
      // >2x headroom over the measured value.
      assert(equal(special.besselKnu(4.82, 7.18), 0.001539804158137713, 8))
    })

    it('should match mpmath for an order requiring multiple order-reduction recurrence steps, on both sides of the x=6 crossover', () => {
      // mpmath mp.dps=50: besselk(7.5, 5.0) -> 0.39645666605558294 (x<=6 connection-formula base)
      // mpmath mp.dps=50: besselk(7.5, 10.0) -> 0.00023814095655825686 (x>6 asymptotic base)
      // nu=7.5 reduces to mu=-0.5, n=8: 7 upward-recurrence steps from the base pair. Default
      // precision=10 (1e-10) holds comfortably here: measured relative error is ~1.06e-11 at
      // x=5.0 (float rounding through the recurrence) and exactly 0 at x=10.0 -- nu=7.5 is
      // half-integer, so both the connection formula and _KAsymptotic terminate exactly.
      assert(equal(special.besselKnu(7.5, 5.0), 0.39645666605558294))
      assert(equal(special.besselKnu(7.5, 10.0), 0.00023814095655825686))
    })

    it('should be even in nu (K_{-nu} = K_nu) for a fractional order in the fixed regime', () => {
      // The order-reduction fix reduces on Math.abs(nu); this exercises that reduction still
      // produces the correct value (not just internal self-consistency) for negative nu.
      // mpmath mp.dps=50: besselk(-7.5, 10.0) -> 0.00023814095655825686 (same as +7.5)
      assert(equal(special.besselKnu(-7.5, 10.0), 0.00023814095655825686))
      assert.strictEqual(special.besselKnu(-7.5, 10.0), special.besselKnu(7.5, 10.0))
    })

    it('should throw for non-finite nu instead of looping forever', () => {
      // Math.round(Math.abs(nu)) would be Infinity for nu = +-Infinity, making
      // _besselKnuReduced's upward-recurrence loop (bound by that value) run forever instead
      // of terminating after a bounded number of steps.
      for (const nu of [Infinity, -Infinity, NaN]) {
        assert.throws(() => special.besselKnu(nu, 5))
      }
    })
  })
})
