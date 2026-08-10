import { assert } from 'chai'
import { describe, it } from 'mocha'
import CompoundPoisson from '../../src/process/compound-poisson'
import CompoundPoissonProcess from '../../src/process/compound-poisson-process'
import { Normal, Gamma, Poisson, Tweedie } from '../../src/dist'
import { MOMENT_SEEDS, K_SIGMA, assertSampleMoments, sampleResetSteps, withSuppressedWarnings, captureWarnings } from './_helpers'

describe('process.CompoundPoisson', () => {
  describe('constructor', () => {
    it('should throw on lambda = 0', () => {
      assert.throws(() => new CompoundPoisson(new Normal(1, 1), 0, 1), /Invalid parameters/)
    })

    it('should throw on lambda < 0', () => {
      assert.throws(() => new CompoundPoisson(new Normal(1, 1), -1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new CompoundPoisson(new Normal(1, 1), 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new CompoundPoisson(new Normal(1, 1), 1, -0.5), /Invalid parameters/)
    })

    it('should throw on lambda = NaN', () => {
      assert.throws(() => new CompoundPoisson(new Normal(1, 1), NaN, 1), /Invalid parameters/)
    })

    it('should throw when jumpDist is undefined', () => {
      assert.throws(() => new CompoundPoisson(undefined, 1, 1), /Invalid parameters/)
    })

    it('should throw when jumpDist is null', () => {
      assert.throws(() => new CompoundPoisson(null, 1, 1), /Invalid parameters/)
    })

    it('should throw when jumpDist has no .sample() method', () => {
      assert.throws(() => new CompoundPoisson({ mean: () => 0 }, 1, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new CompoundPoisson(new Normal(1, 1), 2, 0.5))
    })

    it('should accept default lambda and dt when jumpDist is provided', () => {
      assert.doesNotThrow(() => new CompoundPoisson(new Normal(0, 1), 1, 1))
    })

    it('should start at state 0', () => {
      const cpp = new CompoundPoisson(new Normal(1, 1), 2, 1)
      assert.strictEqual(cpp.state(), 0)
    })
  })

  describe('path', () => {
    it('should start at 0', () => {
      const cpp = new CompoundPoisson(new Poisson(1), 2, 1)
      assert.strictEqual(cpp.path(10)[0], 0)
    })

    it('should be non-decreasing with non-negative jumps', () => {
      const cpp = new CompoundPoisson(new Poisson(2), 3, 0.5)
      cpp.seed(42)
      const path = cpp.path(200)
      for (let i = 1; i < path.length; i++) {
        assert(path[i] >= path[i - 1])
      }
    })
  })

  describe('.mean()', () => {
    it('should return 0 at t=0', () => {
      const cpp = new CompoundPoisson(new Normal(2, 1), 3, 1)
      assert.strictEqual(cpp.mean(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const cpp = new CompoundPoisson(new Normal(1, 1), 2, 1)
      assert(Number.isNaN(cpp.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return 0 at t=0', () => {
      const cpp = new CompoundPoisson(new Normal(1, 1), 2, 1)
      assert.strictEqual(cpp.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const cpp = new CompoundPoisson(new Normal(1, 1), 2, 1)
      assert(Number.isNaN(cpp.variance(-1)))
    })
  })

  describe('.covariogram()', () => {
    it('should be symmetric', () => {
      const cpp = new CompoundPoisson(new Normal(2, 1), 3, 1)
      assert.closeTo(cpp.covariogram(2, 5), cpp.covariogram(5, 2), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const cpp = new CompoundPoisson(new Normal(2, 1), 3, 1)
      // exact rational: variance(3) = covariogram(3, 3) = 3*3*(1+4) = 45
      assert.closeTo(cpp.covariogram(3, 3), cpp.variance(3), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const cpp = new CompoundPoisson(new Normal(1, 1), 2, 1)
      assert(Number.isNaN(cpp.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const cpp = new CompoundPoisson(new Normal(1, 1), 2, 1)
      assert(Number.isNaN(cpp.covariogram(2, -1)))
    })
  })

  describe('.seed()', () => {
    it('should produce identical paths when seeded identically', () => {
      const cpp = new CompoundPoisson(new Normal(1, 1), 2, 1)
      cpp.seed(42)
      const path1 = cpp.path(30)
      cpp.seed(42)
      const path2 = cpp.path(30)
      assert.deepEqual(path1, path2)
    })

    it('should produce different paths for different seeds', () => {
      const cpp = new CompoundPoisson(new Normal(1, 1), 2, 1)
      cpp.seed(1)
      const path1 = cpp.path(30)
      cpp.seed(2)
      const path2 = cpp.path(30)
      assert.notDeepEqual(path1, path2)
    })

    it('should return this for chaining', () => {
      const cpp = new CompoundPoisson(new Normal(1, 1), 2, 1)
      assert.strictEqual(cpp.seed(0), cpp)
    })
  })

  describe('.params()', () => {
    it('returns a jumpDist that is not the same reference as the live instance\'s', () => {
      const cpp = new CompoundPoisson(new Gamma(2, 1), 3, 1)
      assert.notStrictEqual(cpp.params().jumpDist, cpp.p.jumpDist)
    })

    it('seeding params().jumpDist does not desync the live process\'s future path', () => {
      // Reproduces the aliasing bug: _next() samples from this.p.jumpDist directly every step
      // with no per-step reseed (unlike CompoundPoisson.prototype.seed(), which only reseeds
      // jumpDist once), so a live reference let an external .seed() call on the "snapshot"
      // silently desync the process's own reproducible stream.
      const cpp1 = new CompoundPoisson(new Gamma(2, 1), 3, 1).seed(42)
      const path1 = cpp1.path(20)

      const cpp2 = new CompoundPoisson(new Gamma(2, 1), 3, 1).seed(42)
      cpp2.params().jumpDist.seed(999)
      const path2 = cpp2.path(20)

      assert.deepEqual(path1, path2)
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const cpp = new CompoundPoisson(new Normal(0, 1), 2, 1)
      cpp.seed(42)
      for (let i = 0; i < 10; i++) cpp.next()
      cpp.reset()
      assert.strictEqual(cpp.state(), 0)
    })
  })

  describe('increments', () => {
    it('should have mean and variance matching lambda*dt*E[J] and lambda*dt*E[J^2] across seeds', () => {
      const lambda = 2
      const dt = 0.5
      const muJ = 1
      const n = 5000
      // exact rational: compound Poisson increment has mean = lambda*dt*E[J], variance = lambda*dt*E[J^2];
      // for jumpDist = Normal(muJ, 1), E[J] = muJ and E[J^2] = Var(J) + E[J]^2 = 1 + muJ^2
      const expectedMean = lambda * dt * muJ
      const expectedVariance = lambda * dt * (1 + muJ * muJ)
      for (const seed of MOMENT_SEEDS) {
        const cpp = new CompoundPoisson(new Normal(muJ, 1), lambda, dt)
        cpp.seed(seed)
        assertSampleMoments(sampleResetSteps(cpp, n), expectedMean, expectedVariance, seed)
      }
    })
  })

  describe('.marginal()', () => {
    it('should throw a CompoundPoisson-specific error explaining the general case is unsupported', () => {
      const cpp = new CompoundPoisson(new Normal(1, 1), 2, 1)
      assert.throws(() => cpp.marginal(1), /CompoundPoisson\.marginal\(\): no closed form exists for an arbitrary jump distribution/)
    })

    it('should throw for t <= 0 even with a Gamma jumpDist', () => {
      const cpp = new CompoundPoisson(new Gamma(2, 3), 2, 1)
      assert.throws(() => cpp.marginal(0), /t must be > 0/)
      assert.throws(() => cpp.marginal(-1), /t must be > 0/)
    })

    it('should return a Tweedie instance for a Gamma jumpDist, matching mean and variance', () => {
      const alpha = 2
      const beta = 3
      const lambda = 2
      const t = 1.5
      const cpp = new CompoundPoisson(new Gamma(alpha, beta), lambda, 1)
      const marginal = cpp.marginal(t)
      assert.instanceOf(marginal, Tweedie)
      assert.closeTo(marginal.mean(), cpp.mean(t), 1e-10)
      assert.closeTo(marginal.variance(), cpp.variance(t), 1e-10)
    })

    it('should return a Tweedie marginal whose pdf/cdf match the exact Poisson-gamma mixture', () => {
      // exact rational: P(Y=0) = P(N=0) = exp(-lambda*t) for the compound Poisson-gamma mixture,
      // which is also Tweedie's own point-mass formula -- an independent closed-form check that
      // does not rely on the marginal()/Tweedie parameter-mapping algebra under test.
      const alpha = 2
      const beta = 3
      const lambda = 2
      const t = 1.5
      const cpp = new CompoundPoisson(new Gamma(alpha, beta), lambda, 1)
      const marginal = cpp.marginal(t)
      assert.closeTo(marginal.pdf(0), Math.exp(-lambda * t), 1e-10)
      assert.closeTo(marginal.cdf(0), Math.exp(-lambda * t), 1e-10)

      // Independent reference for an interior point (x = mu, the Tweedie mean), built directly
      // from the compound Poisson-gamma series rather than the marginal()/Tweedie parameter
      // mapping under test: X_t = sum_{i=1}^{N} J_i with N ~ Poisson(lambda*t) and
      // J_i ~ Gamma(alpha, beta), so J_1 + ... + J_n ~ Gamma(n*alpha, beta) for n >= 1 (sum of
      // n i.i.d. Gamma(alpha, beta) variates), giving
      // pdf(x) = sum_{n=1}^{inf} Poisson(lambda*t).pdf(n) * Gamma(n*alpha, beta).pdf(x) and
      // cdf(x) = exp(-lambda*t)*(x>=0) + sum_{n=1}^{inf} Poisson(lambda*t).pdf(n) * Gamma(n*alpha, beta).cdf(x).
      // The series is truncated at N = 30, where the Poisson(3) tail 1 - cdf(30) is far below
      // 1e-12, so truncation error is negligible next to the comparison tolerance.
      // mu = lambda*t*alpha/beta = 2*1.5*2/3 (exact rational) = 2.
      const mu = 2
      // mpmath mp.dps=50: sum_{n=1}^{30} Poisson(3).pmf(n) * Gamma(2n, scale=1/3).pdf(2), with
      // Gamma.pdf/cdf and Poisson.pmf reimplemented from scratch via mpmath's own
      // exp/log/loggamma/gammainc -> 0.26858960310934577112955117114307537913148585514259
      const pdfRef = 0.26858960310934576
      // mpmath mp.dps=50: exp(-3) + sum_{n=1}^{30} Poisson(3).pmf(n) * Gamma(2n, scale=1/3).cdf(2)
      // -> 0.56348946343750803140234169015766437926068330168143
      const cdfRef = 0.563489463437508
      assert.closeTo(marginal.pdf(mu), pdfRef, 1e-8)
      assert.closeTo(marginal.cdf(mu), cdfRef, 1e-8)
    })
  })

  describe('.fit()', () => {
    it('should recover lambda and the jump distribution from a long simulated path across seeds', () => {
      const muJ = 2
      const sigmaJ = 0.5
      const lambda = 0.5
      const dt = 0.02
      const n = 200000
      // fit() treats every non-zero increment as exactly one jump, since individual arrival
      // counts within a dt interval are not observable from the cumulative path alone. This is
      // exact only when at most one jump ever lands in the same interval; at lambda*dt = 0.01
      // the probability of a merged 2+-jump interval is negligible (~5e-5), so the systematic
      // bias this approximation introduces is far below the sampling noise below.
      const p = 1 - Math.exp(-lambda * dt)
      const m = n * p // expected number of detected jumps
      const tolLambda = K_SIGMA * Math.sqrt(lambda / (n * dt))
      const tolMuJ = K_SIGMA * sigmaJ / Math.sqrt(m)
      const tolSigmaJ = K_SIGMA * sigmaJ / Math.sqrt(2 * (m - 1))
      for (const seed of MOMENT_SEEDS) {
        const cpp = new CompoundPoisson(new Normal(muJ, sigmaJ), lambda, dt)
        cpp.seed(seed)
        const fitted = CompoundPoisson.fit(cpp.path(n), dt, Normal)
        assert.instanceOf(fitted, CompoundPoisson)
        assert.closeTo(fitted.params().lambda, lambda, tolLambda, `seed ${seed}: lambda`)
        assert.instanceOf(fitted.params().jumpDist, Normal)
        const { mu: fittedMuJ, sigma: fittedSigmaJ } = fitted.params().jumpDist.params()
        assert.closeTo(fittedMuJ, muJ, tolMuJ, `seed ${seed}: muJ`)
        assert.closeTo(fittedSigmaJ, sigmaJ, tolSigmaJ, `seed ${seed}: sigmaJ`)
      }
    })

    it('should default dt to 1', () => {
      const cpp = new CompoundPoisson(new Normal(0, 1), 2, 1)
      cpp.seed(1)
      const fitted = CompoundPoisson.fit(cpp.path(20000), undefined, Normal)
      assert.strictEqual(fitted.params().dt, 1)
    })

    it('should throw when path has fewer than 2 states', () => {
      assert.throws(() => CompoundPoisson.fit([0], 1, Normal), /at least 2 states/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => CompoundPoisson.fit([0, 1, 2], 0, Normal), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => CompoundPoisson.fit([0, 1, 2], -1, Normal), /Invalid parameters/)
    })

    it('should throw when jumpDistConstructor has no static fit()', () => {
      assert.throws(() => CompoundPoisson.fit([0, 1, 2], 1, {}), /static fit\(\) method/)
    })

    it('should throw when jumpDistConstructor is missing', () => {
      assert.throws(() => CompoundPoisson.fit([0, 1, 2], 1), /static fit\(\) method/)
    })

    it('should throw when the path has no non-zero increments', () => {
      assert.throws(() => CompoundPoisson.fit([0, 0, 0], 1, Normal), /no non-zero increments/)
    })
  })
})

describe('process.CompoundPoissonProcess (deprecated alias)', () => {
  it('should be an instance of CompoundPoisson and behave identically', () => {
    const cpp = withSuppressedWarnings(() => new CompoundPoissonProcess(new Normal(1, 1), 2, 1))
    assert(cpp instanceof CompoundPoisson)
    assert.strictEqual(cpp.mean(3), new CompoundPoisson(new Normal(1, 1), 2, 1).mean(3))
  })

  it('should emit a deprecation warning naming the replacement', () => {
    let cpp
    const warnings = captureWarnings(() => { cpp = new CompoundPoissonProcess(new Normal(1, 1), 2, 1) })
    assert(cpp instanceof CompoundPoisson)
    assert.strictEqual(warnings.length, 1)
    assert.match(warnings[0], /ran\.process\.CompoundPoissonProcess is deprecated and will be removed in v1\.33\.0; use ran\.process\.CompoundPoisson instead\./)
  })

  it('should have .fit() return a CompoundPoissonProcess instance, not a plain CompoundPoisson', () => {
    const fitted = withSuppressedWarnings(() => {
      const cpp = new CompoundPoissonProcess(new Normal(2, 0.5), 2, 1)
      cpp.seed(1)
      return CompoundPoissonProcess.fit(cpp.path(5000), 1, Normal)
    })
    assert.instanceOf(fitted, CompoundPoissonProcess)
  })
})
