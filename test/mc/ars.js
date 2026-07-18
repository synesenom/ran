import { assert } from 'chai'
import { describe, it } from 'mocha'
import ARS from '../../src/mc/ars'
import { Normal, Gamma, Beta } from '../../src/dist'
import { ksTest } from '../test-utils'

describe('mc.ARS', () => {
  describe('constructor', () => {
    it('should throw when support is missing', () => {
      assert.throws(() => new ARS(x => -0.5 * x * x), /support/)
    })

    it('should throw when support does not have length 2', () => {
      assert.throws(() => new ARS(x => -0.5 * x * x, [-1]), /support/)
    })

    it('should throw when support[0] >= support[1]', () => {
      assert.throws(() => new ARS(x => -0.5 * x * x, [1, 1]), /support/)
      assert.throws(() => new ARS(x => -0.5 * x * x, [2, 1]), /support/)
    })

    it('should throw when support contains a non-finite bound', () => {
      assert.throws(() => new ARS(x => -0.5 * x * x, [-Infinity, 8]), /support/)
      assert.throws(() => new ARS(x => -0.5 * x * x, [-8, Infinity]), /support/)
      assert.throws(() => new ARS(x => -0.5 * x * x, [NaN, 8]), /support/)
    })

    it('should throw when logDensity is not a function', () => {
      assert.throws(() => new ARS(null, [-8, 8]), /logDensity/)
    })

    it('should not throw for a valid log-concave target and finite support', () => {
      assert.doesNotThrow(() => new ARS(x => -0.5 * x * x, [-8, 8], x => -x))
    })

    it('should throw when derivative is provided but is not a function', () => {
      assert.throws(() => new ARS(x => -0.5 * x * x, [-8, 8], 5), /derivative/)
    })
  })

  describe('._tangentIntersection()', () => {
    it('should fall back to the midpoint when two slopes differ by less than the finite-difference noise floor', () => {
      const ars = new ARS(x => -0.5 * x * x, [-8, 8], x => -x)
      // A dh difference of 1e-10 is far above raw Number.EPSILON (~2.22e-16) -- so the old
      // raw-EPS guard would not fire -- but far below the Math.cbrt(EPSILON) (~6.06e-6) noise
      // floor the finite-difference slopes actually carry. Left ungated, the division puts the
      // breakpoint at roughly -2e10, wildly outside the [pi.x, pj.x] = [-1, 1] bracket a hull
      // breakpoint must lie in; the fix must instead return the midpoint.
      const pi = { x: -1, h: 0, dh: 1 }
      const pj = { x: 1, h: 0, dh: 1 - 1e-10 }
      assert.strictEqual(ars._tangentIntersection(pi, pj), 0)
    })

    it('should compute the closed-form intersection when slopes differ by more than the noise floor', () => {
      const ars = new ARS(x => -0.5 * x * x, [-8, 8], x => -x)
      const pi = { x: -1, h: 1, dh: 2 }
      const pj = { x: 3, h: -1, dh: -2 }
      // exact rational: (pj.h - pi.h - pj.x*pj.dh + pi.x*pi.dh) / (pi.dh - pj.dh)
      //               = (-1 - 1 - 3*(-2) + (-1)*2) / (2 - (-2)) = (-2 + 6 - 2) / 4 = 0.5
      // distinct from the midpoint (pi.x + pj.x) / 2 = 1, confirming the closed-form branch ran
      assert.strictEqual(ars._tangentIntersection(pi, pj), 0.5)
    })

    it('should switch branches on either side of the tolerance boundary', () => {
      const ars = new ARS(x => -0.5 * x * x, [-8, 8], x => -x)
      // With |pi.dh| = 1 and |pj.dh| close to 1, tol = CBRT_EPS * max(1, |pi.dh|, |pj.dh|)
      // reduces to CBRT_EPS itself, so the two cases below straddle the guard's own threshold
      // from just inside to just outside, rather than only exercising each branch deep in its
      // interior as the two tests above do.
      const tol = Math.cbrt(Number.EPSILON)
      const pi = { x: -1, h: 0, dh: 1 }

      const justInside = { x: 1, h: 0, dh: 1 - tol * 0.5 }
      assert.strictEqual(ars._tangentIntersection(pi, justInside), 0)

      const justOutside = { x: 1, h: 0, dh: 1 - tol * 1.5 }
      // exact rational: (pj.h - pi.h - pj.x*pj.dh + pi.x*pi.dh) / (pi.dh - pj.dh)
      //               = (0 - 0 - (1 - 1.5*tol) - 1) / (1.5*tol) = (1.5*tol - 2) / (1.5*tol)
      // dominated by -2 / (1.5*tol) once tol is this small, landing far outside [pi.x, pj.x] --
      // confirms the closed-form (division) branch ran rather than the midpoint fallback
      assert(Math.abs(ars._tangentIntersection(pi, justOutside)) > 100,
        'expected the closed-form division branch, not the midpoint fallback, just past the tolerance boundary')
    })
  })

  describe('.sample() distributional test', () => {
    // Fixed seeds (matching the mc.RWM.seed() convention) rather than a single unseeded run:
    // a KS test at this significance threshold has an inherent ~1% false-positive rate per draw,
    // so an unseeded test would flake at that rate on every CI run. Pinning specific seeds makes
    // the outcome deterministic and reproducible instead of trading flakiness for a coin flip.
    // See solutions/testing/2026-07-15-1044-ars-unseeded-ks-test-flake-fixed-seeds.md
    const seeds = [0, 42, 12345]

    seeds.forEach(seed => {
      it(`should produce samples matching Normal(0,1) target (KS test, seed ${seed})`, () => {
        const lo = -8
        const hi = 8
        // unnormalized: dropping the -0.5*log(2*pi) constant does not change the sampled shape
        const ars = new ARS(x => -0.5 * x * x, [lo, hi], x => -x).seed(seed)
        const samples = ars.sample(2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples, x => ref.cdf(x)))
        assert(samples.every(x => x >= lo && x <= hi))
      })
    })

    seeds.forEach(seed => {
      it(`should produce samples matching a Gamma(3, 1.5) target without an explicit derivative (KS test, seed ${seed})`, () => {
        const alpha = 3
        const beta = 1.5
        const lo = 1e-3
        const hi = 15
        // unnormalized: dropping the log(beta^alpha / Gamma(alpha)) constant does not change the sampled shape
        const ars = new ARS(x => (alpha - 1) * Math.log(x) - beta * x, [lo, hi]).seed(seed)
        const samples = ars.sample(2000)
        const ref = new Gamma(alpha, beta)
        assert(ksTest(samples, x => ref.cdf(x)))
        assert(samples.every(x => x >= lo && x <= hi))
      })
    })

    seeds.forEach(seed => {
      it(`should produce samples matching a Beta(2, 3) target (KS test, seed ${seed})`, () => {
        const alpha = 2
        const beta = 3
        const lo = 1e-3
        const hi = 1 - 1e-3
        // unnormalized: dropping the -log(B(alpha, beta)) constant does not change the sampled shape
        const logDensity = x => (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x)
        const derivative = x => (alpha - 1) / x - (beta - 1) / (1 - x)
        const ars = new ARS(logDensity, [lo, hi], derivative).seed(seed)
        const samples = ars.sample(2000)
        const ref = new Beta(alpha, beta)
        assert(ksTest(samples, x => ref.cdf(x)))
        assert(samples.every(x => x >= lo && x <= hi))
      })
    })

    // The middle of the three initial quartile abscissae falls exactly at the support midpoint
    // (x = 0 for a symmetric bracket). A vanishingly small mu shifts its tangent slope away from
    // the exact dh = 0 special case (already covered by the Normal(0,1) test above) into the
    // near-degenerate regime: strictly nonzero but far below the finite-difference noise floor.
    // This exercises the code path #941 fixed, but cannot regress-test the underlying
    // catastrophic-cancellation bug itself to a tight bound: dividing by a near-zero dh in the
    // buggy general-case inversion formula can in principle distort the drawn x away from the
    // exponential shape the accept/reject step assumes, but any such distortion is bounded by
    // the same tiny dh-scale error that motivated the fix -- far below what a 2000-sample KS
    // test can resolve at any seed we could practically pin. This test's role is coverage of the
    // near-degenerate branch, not a precision bound. See https://github.com/synesenom/ran/issues/941
    ;[0, 42, 12345].forEach(seed => {
      it(`should produce samples matching a Normal target whose midpoint abscissa has a near-zero-but-nonzero slope (KS test, seed ${seed})`, () => {
        const lo = -8
        const hi = 8
        const mu = 1e-13
        const ars = new ARS(x => -0.5 * (x - mu) * (x - mu), [lo, hi], x => -(x - mu)).seed(seed)
        const samples = ars.sample(2000)
        const ref = new Normal(mu, 1)
        assert(ksTest(samples, x => ref.cdf(x)))
        assert(samples.every(x => x >= lo && x <= hi))
      })
    })
  })

  describe('adaptive envelope tightening', () => {
    // Seeded for a deterministic, reproducible comparison: with only a handful of abscissae,
    // almost all hull-tightening happens in the first few dozen draws, so comparing a small
    // early block against a much larger later block (rather than asserting strict pairwise
    // monotonicity across many same-sized blocks, which is dominated by sampling noise once
    // the envelope has already converged) is the robust way to observe the tightening effect.
    // Extra logDensity calls (beyond the one-per-draw baseline) are counted directly rather
    // than as a ratio, so a block that happens to need zero extra evaluations can't produce a
    // vacuous Infinity/Infinity comparison.
    ;[0, 42, 12345].forEach(seed => {
      it(`should require far fewer extra logDensity evaluations per draw once the envelope has tightened (seed ${seed})`, () => {
        let calls = 0
        const logDensity = x => { calls++; return -0.5 * x * x }
        const ars = new ARS(logDensity, [-8, 8], x => -x).seed(seed)

        const c0 = calls
        ars.sample(50)
        const earlyExtraCalls = calls - c0

        const c1 = calls
        ars.sample(3000)
        const laterExtraCalls = calls - c1

        // the hull is still coarse after only 3 bootstrap points, so tightening it requires
        // at least a few extra evaluations during the small early block
        assert(earlyExtraCalls > 0, 'expected at least one extra logDensity call while the envelope is still forming')
        // once converged, the vast majority of the later block's draws should be accepted via
        // the squeeze test alone — an absolute bound, not just a relative one
        assert(laterExtraCalls / 3000 < 0.05, `later block needed ${laterExtraCalls} extra calls over 3000 draws`)
        assert(earlyExtraCalls / 50 > laterExtraCalls / 3000, 'evaluation rate did not improve from the early to the later block')
      })
    })
  })

  describe('non-log-concave target', () => {
    it('should throw an Error for a clearly non-log-concave (bimodal) density', () => {
      const logDensity = x => Math.log(
        0.5 * Math.exp(-0.5 * (x + 3) * (x + 3)) + 0.5 * Math.exp(-0.5 * (x - 3) * (x - 3))
      )
      assert.throws(() => new ARS(logDensity, [-8, 8]), /log-concave/)
    })
  })

  describe('.seed()', () => {
    it('should produce bitwise-identical samples when the same seed is applied twice', () => {
      const logDensity = x => -0.5 * x * x
      const derivative = x => -x

      const ars1 = new ARS(logDensity, [-8, 8], derivative).seed(42)
      const samples1 = ars1.sample(50)

      const ars2 = new ARS(logDensity, [-8, 8], derivative).seed(42)
      const samples2 = ars2.sample(50)

      assert.deepEqual(samples1, samples2)
    })
  })
})
