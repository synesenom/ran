import { assert } from 'chai'
import { describe, it } from 'mocha'
import AR1 from '../../src/process/ar1'
import { Normal } from '../../src/dist'
import { MOMENT_SEEDS, K_SIGMA, assertSampleMoments } from './_helpers'

describe('process.AR1', () => {
  describe('constructor', () => {
    it('should throw on sigma = 0', () => {
      assert.throws(() => new AR1(0.5, 0), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new AR1(0.5, -1), /Invalid parameters/)
    })

    it('should throw on sigma = NaN', () => {
      assert.throws(() => new AR1(0.5, NaN), /Invalid parameters/)
    })

    it('should throw on phi = NaN', () => {
      assert.throws(() => new AR1(NaN, 1), /Invalid parameters/)
    })

    it('should accept |phi| >= 1 without throwing (non-stationary)', () => {
      assert.doesNotThrow(() => new AR1(1, 1))
      assert.doesNotThrow(() => new AR1(1.5, 1))
      assert.doesNotThrow(() => new AR1(-1.2, 1))
    })

    it('should accept valid stationary parameters', () => {
      assert.doesNotThrow(() => new AR1(0.5, 1))
      assert.doesNotThrow(() => new AR1(-0.9, 2))
    })

    it('should start at state 0', () => {
      assert.strictEqual(new AR1(0.5, 1).state(), 0)
    })
  })

  describe('.mean()', () => {
    it('should return 0 for t >= 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert.strictEqual(ar1.mean(0), 0)
      assert.strictEqual(ar1.mean(5), 0)
      assert.strictEqual(ar1.mean(100), 0)
    })

    it('should return NaN for t < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return 0 at t = 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert.strictEqual(ar1.variance(0), 0)
    })

    it('should return 0 at t = 0 for phi = 0 (phi2 = 0 would otherwise hit 0*log(0) = NaN)', () => {
      const ar1 = new AR1(0, 1)
      assert.strictEqual(ar1.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.variance(-1)))
    })

    it('should grow monotonically for |phi| > 1', () => {
      const ar1 = new AR1(1.5, 1)
      assert(ar1.variance(10) > ar1.variance(5))
      assert(ar1.variance(20) > ar1.variance(10))
    })

    it('should not collapse to 0 via cancellation for near-unit-root phi and small fractional t', () => {
      // phi2 = 1 - 2e-14 lies just outside the 1e-14 special-case band; at
      // t = 1e-6, 1 - phi2^t previously rounded to exactly 0 (100% error)
      const ar1 = new AR1(Math.sqrt(1 - 2e-14), 1)
      assert.isAbove(ar1.variance(1e-6), 0)
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t = 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.pdf(0, 0)))
    })

    it('should return NaN for t < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.pdf(0, -1)))
    })

    it('should be symmetric around 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert.closeTo(ar1.pdf(-1, 3), ar1.pdf(1, 3), 1e-10)
    })
  })

  describe('.covariogram()', () => {
    it('should equal variance at s = t', () => {
      const ar1 = new AR1(0.5, 1)
      assert.closeTo(ar1.covariogram(2, 2), ar1.variance(2), 1e-10)
    })

    it('should be symmetric: covariogram(s, t) = covariogram(t, s)', () => {
      const ar1 = new AR1(0.5, 1)
      assert.closeTo(ar1.covariogram(2, 3), ar1.covariogram(3, 2), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.covariogram(2, -1)))
    })

    // Cov(X_t, X_t) = Var(X_t) by definition, so this identity must hold in the same
    // near-unit-root regime #1243 fixed in variance(); covariogram() carried the same
    // cancellation-prone 1 - Math.pow(phi2, minTime) expression and collapsed to exactly 0.
    it('should equal variance at s = t for near-unit-root phi and small fractional t', () => {
      for (const [phi, sigma] of [[Math.sqrt(1 - 2e-14), 1], [Math.sqrt(1 - 5e-13), 1.5]]) {
        const ar1 = new AR1(phi, sigma)
        for (const t of [1e-6, 1e-4, 0.002, 0.01, 0.1]) {
          const v = ar1.variance(t)
          assert(v > 0, `variance(${t}) must stay positive for phi = ${phi}`)
          assert.closeTo(ar1.covariogram(t, t) / v, 1, 1e-12,
            `covariogram(${t}, ${t}) must match variance(${t}) for phi = ${phi}`)
        }
      }
    })

    // mpmath mp.dps=50, evaluating the untransformed phi^|t-s| * sigma^2 * (1-phi2^min(s,t))/(1-phi2)
    // against the exact double phi (0x3fefffffffffffa6 = Math.sqrt(1-2e-14),
    // 0x3feffffffffff734 = Math.sqrt(1-5e-13)) -- not the expm1 form the fix uses.
    it('should match high-precision references for near-unit-root phi', () => {
      const phiA = Math.sqrt(1 - 2e-14)
      const phiB = Math.sqrt(1 - 5e-13)
      // Each literal is the nearest double to the mpmath value shown after it.
      const cases = [
        // phi, sigma, s, t, reference                    mpmath mp.dps=50 value
        [phiA, 1, 1e-6, 1e-6, 0.00000100000000000001], //  1.0000000000000099467e-6
        [phiA, 1, 1e-6, 3e-6, 0.00000100000000000001], //  1.0000000000000099467e-6
        [phiA, 2, 0.01, 0.03, 0.04000000000000039], //     0.040000000000000388523
        [phiB, 1.5, 1e-4, 1e-4, 0.00022500000000005626], // 0.00022500000000005626016
        [phiB, 1, 0.002, 0.005, 0.0020000000000004975] //  0.0020000000000004975859
      ]
      for (const [phi, sigma, s, t, expected] of cases) {
        const actual = new AR1(phi, sigma).covariogram(s, t)
        assert.closeTo(actual / expected, 1, 1e-12,
          `covariogram(${s}, ${t}) for phi = ${phi}, sigma = ${sigma}`)
      }
    })

    // Math.pow(phi2, 0) === 1 for every phi2 per the ECMAScript spec, so the pre-expm1
    // formula was accidentally well-defined at min(s, t) = 0; t * Math.log(phi2) is not
    // (0 * -Infinity = NaN when phi2 underflows to 0). X_0 = 0 deterministically, so the
    // covariance with it is exactly 0 for every phi -- including phi = 0 and huge phi.
    it('should return 0 when either time is 0, for every phi', () => {
      for (const phi of [0, 1e-200, 0.5, 1, 1.5, 1e200, -0.5, -1]) {
        const ar1 = new AR1(phi, 1)
        assert.strictEqual(ar1.covariogram(0, 0), 0, `covariogram(0, 0) for phi = ${phi}`)
        assert.strictEqual(ar1.covariogram(0, 3), 0, `covariogram(0, 3) for phi = ${phi}`)
        assert.strictEqual(ar1.covariogram(3, 0), 0, `covariogram(3, 0) for phi = ${phi}`)
      }
    })

    // The |phi2 - 1| < 1e-14 unit-root branch was the file's only uncovered line; at
    // phi = 1 the geometric series degenerates to the random-walk covariance sigma^2*min(s,t).
    it('should reduce to the random-walk covariance at the unit root', () => {
      const ar1 = new AR1(1, 2)
      // exact rational: phi = 1 => Cov(X_s, X_t) = sigma^2 * min(s, t) = 4 * 3 = 12
      assert.closeTo(ar1.covariogram(3, 7), 12, 1e-10)
      assert.closeTo(ar1.covariogram(7, 3), 12, 1e-10)
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const ar1 = new AR1(0.5, 1)
      ar1.seed(42)
      for (let i = 0; i < 10; i++) ar1.next()
      ar1.reset()
      assert.strictEqual(ar1.state(), 0)
    })
  })

  describe('stationarity', () => {
    it('should converge to stationary mean 0 and variance sigma^2/(1-phi^2) across seeds', () => {
      const phi = 0.5
      const sigma = 1
      // exact rational: AR1 stationary variance = sigma^2/(1-phi^2) = 1/(1-0.25) = 4/3
      const stationaryVariance = sigma * sigma / (1 - phi * phi)
      for (const seed of MOMENT_SEEDS) {
        const ar1 = new AR1(phi, sigma)
        ar1.seed(seed)
        // burn in to reach stationarity
        for (let i = 0; i < 500; i++) ar1.next()
        // thin by 10: lag-10 autocorrelation = phi^10 ≈ 0.001, effectively independent
        const samples = []
        for (let i = 0; i < 10000; i++) {
          ar1.next()
          if (i % 10 === 0) samples.push(ar1.state())
        }
        assertSampleMoments(samples, 0, stationaryVariance, seed)
      }
    })
  })

  describe('explosive growth', () => {
    it('should exhibit growing variance for |phi| > 1', () => {
      const ar1 = new AR1(1.5, 1)
      ar1.seed(42)
      // run ensemble of 30 paths; at step 30 theoretical Var ≈ phi^60/1.25 ≈ 3.5e10
      const paths = ar1.ensemble(20, 30)
      const earlyMSV = paths.map(p => p[1] * p[1]).reduce((a, b) => a + b) / paths.length
      const lateMSV = paths.map(p => p[30] * p[30]).reduce((a, b) => a + b) / paths.length
      assert(lateMSV > earlyMSV * 100)
    })
  })

  describe('.marginal()', () => {
    it('should return a Normal instance with variance matching variance(t)', () => {
      const ar1 = new AR1(0.5, 2)
      const marginal = ar1.marginal(2)
      assert.instanceOf(marginal, Normal)
      assert.strictEqual(marginal.mean(), 0)
      assert.closeTo(marginal.variance(), ar1.variance(2), 1e-10)
    })

    it('should have pdf matching process.pdf(x, t)', () => {
      const ar1 = new AR1(0.5, 1)
      const marginal = ar1.marginal(2)
      assert.closeTo(marginal.pdf(0), ar1.pdf(0, 2), 1e-10)
      // non-zero x exercises the z = x/s scaling term, which pdf(0) alone cannot catch
      assert.closeTo(marginal.pdf(1), ar1.pdf(1, 2), 1e-10)
    })

    it('should invert cdf via quantile', () => {
      const ar1 = new AR1(0.5, 1)
      const marginal = ar1.marginal(2)
      assert.closeTo(marginal.q(marginal.cdf(1)), 1, 1e-10)
    })

    it('should throw for t = 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert.throws(() => ar1.marginal(0), /t must be > 0/)
    })

    it('should throw for t < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert.throws(() => ar1.marginal(-1), /t must be > 0/)
    })

    // A 29700-point sweep of variance(t) over phi (including a dense grid straddling the
    // 1e-14 reformulation boundary), sigma and t found no strictly negative value for any
    // t > 0 -- the non-stationary |phi| >= 1 branch diverges to +Infinity but never flips
    // sign. See solutions/correctness/2026-08-01-1600-ar1-marginal-variance-guard-reachability.md
    it('should return a positive-variance Normal on the non-stationary branch', () => {
      for (const phi of [1, -1, 1.5, -1.5, 1 + 1e-14, 1 - 1e-14]) {
        const ar1 = new AR1(phi, 1)
        const marginal = ar1.marginal(3)
        assert.instanceOf(marginal, Normal)
        assert(ar1.variance(3) > 0, `variance must stay positive for phi = ${phi}`)
        assert.closeTo(marginal.variance(), ar1.variance(3), 1e-10)
      }
    })

    // v <= 0 is reachable only by floating-point underflow (t below ~1e-322, or sigma below
    // ~1.6e-161 so that sigma^2 underflows). marginal() no longer guards this itself; the
    // degenerate scale must still be rejected, now by Normal's own sigma > 0 validation.
    it('should throw via Normal validation when variance underflows to zero', () => {
      const ar1 = new AR1(0.9, 1)
      assert.strictEqual(ar1.variance(Number.MIN_VALUE), 0)
      assert.throws(() => ar1.marginal(Number.MIN_VALUE), /Invalid parameters/)

      const tiny = new AR1(0.9, 1e-200)
      assert.strictEqual(tiny.variance(1), 0)
      assert.throws(() => tiny.marginal(1), /Invalid parameters/)
    })
  })

  describe('.fit()', () => {
    it('should recover phi and sigma from a long simulated path across seeds', () => {
      const phi = 0.6
      const sigma = 1.3
      const n = 20000
      // AR(1) OLS slope asymptotic variance (Hamilton, "Time Series Analysis", eq. 8.2.16):
      // sqrt(n)(phiHat-phi) -> N(0, 1-phi^2), same formula OrnsteinUhlenbeck.fit()'s test uses
      // for its OLS slope, since the true intercept being 0 here doesn't change the leading term.
      const tolPhi = K_SIGMA * Math.sqrt((1 - phi * phi) / n)
      // s2 = ss/(n-2) is the usual OLS residual-variance estimator; Var(s2) ~ 2*sigma^4/n
      // (same approximation OrnsteinUhlenbeck.fit()'s test uses for its own varS2), propagated
      // through the delta method (sigma = sqrt(s2)) for sigma_hat's tolerance.
      const varS2 = 2 * Math.pow(sigma, 4) / n
      const tolSigma = K_SIGMA * Math.sqrt(varS2) / (2 * sigma)
      for (const seed of MOMENT_SEEDS) {
        const ar1 = new AR1(phi, sigma)
        ar1.seed(seed)
        const fitted = AR1.fit(ar1.path(n))
        assert.instanceOf(fitted, AR1)
        assert.closeTo(fitted.params().phi, phi, tolPhi, `seed ${seed}: phi`)
        assert.closeTo(fitted.params().sigma, sigma, tolSigma, `seed ${seed}: sigma`)
      }
    })

    it('should throw when path has fewer than 4 states', () => {
      assert.throws(() => AR1.fit([0, 1, 2]), /at least 4 states/)
    })

    it('should throw when path is not an array', () => {
      assert.throws(() => AR1.fit(null), /at least 4 states/)
    })

    it('should succeed at exactly 4 states when the path is not perfectly collinear', () => {
      // [0, 1, 2, 2] is not collinear (the last step breaks the straight line), so OLS
      // residuals are not all 0 and sigma2 = ss/(n-2) is strictly positive.
      const fitted = AR1.fit([0, 1, 2, 2])
      assert.instanceOf(fitted, AR1)
      assert.isTrue(Number.isFinite(fitted.params().phi))
      assert.isAbove(fitted.params().sigma, 0)
    })

    it('should throw when a perfectly collinear path drives sigma to 0', () => {
      // A perfectly linear path drives the OLS residuals to exactly 0, so sigma2 = 0
      // and the AR1 constructor's Process.validate('sigma > 0') rejects it, unlike
      // OrnsteinUhlenbeck.fit() which has its own slope-range check for the analogous case.
      assert.throws(() => AR1.fit([0, 1, 2, 3, 4]), /sigma > 0/)
    })
  })
})
