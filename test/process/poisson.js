import { assert } from 'chai'
import { describe, it } from 'mocha'
// Aliased to avoid colliding with ran.dist.Poisson (imported below for a marginal()
// instanceOf check) — the two are unrelated classes that happen to share a bare name
// (decisions/0041-process-subclass-naming-no-process-suffix.md).
import ProcessPoisson from '../../src/process/poisson'
import PoissonProcess from '../../src/process/poisson-process'
import { Poisson } from '../../src/dist'
import { MOMENT_SEEDS, K_SIGMA, assertSampleMoments, sampleSteps, withSuppressedWarnings, captureWarnings } from './_helpers'

describe('process.Poisson', () => {
  describe('constructor', () => {
    it('should throw on lambda = 0', () => {
      assert.throws(() => new ProcessPoisson(0, 1), /Invalid parameters/)
    })

    it('should throw on lambda < 0', () => {
      assert.throws(() => new ProcessPoisson(-1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new ProcessPoisson(1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new ProcessPoisson(1, -0.5), /Invalid parameters/)
    })

    it('should throw on lambda = NaN', () => {
      assert.throws(() => new ProcessPoisson(NaN, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new ProcessPoisson(2, 0.5))
    })

    it('should start at state 0', () => {
      const pp = new ProcessPoisson(1, 1)
      assert.strictEqual(pp.state(), 0)
    })
  })

  describe('path', () => {
    it('should be non-decreasing', () => {
      const pp = new ProcessPoisson(2, 0.1)
      const path = pp.path(200)
      for (let i = 1; i < path.length; i++) {
        assert(path[i] >= path[i - 1])
      }
    })

    it('should be integer-valued', () => {
      const pp = new ProcessPoisson(2, 0.1)
      const path = pp.path(200)
      for (const x of path) {
        assert.strictEqual(x, Math.floor(x))
      }
    })
  })

  describe('increments', () => {
    it('should have mean and variance matching lambda*dt across seeds', () => {
      const lambda = 3
      const dt = 0.5
      const n = 5000
      // exact rational: Poisson(lambda*dt) increment has mean = variance = lambda*dt
      for (const seed of MOMENT_SEEDS) {
        const pp = new ProcessPoisson(lambda, dt)
        pp.seed(seed)
        assertSampleMoments(sampleSteps(pp, n), lambda * dt, lambda * dt, seed)
      }
    })
  })

  describe('.mean()', () => {
    it('should return 0 at t=0', () => {
      const pp = new ProcessPoisson(2, 0.5)
      assert.strictEqual(pp.mean(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const pp = new ProcessPoisson(2, 0.5)
      assert(Number.isNaN(pp.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return 0 at t=0', () => {
      const pp = new ProcessPoisson(2, 0.5)
      assert.strictEqual(pp.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const pp = new ProcessPoisson(2, 0.5)
      assert(Number.isNaN(pp.variance(-1)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t < 0', () => {
      const pp = new ProcessPoisson(1, 1)
      assert(Number.isNaN(pp.pdf(0, -1)))
    })

    it('should return 0 for non-integer x', () => {
      const pp = new ProcessPoisson(2, 1)
      assert.strictEqual(pp.pdf(1.5, 1), 0)
    })

    it('should return 0 for negative integer x', () => {
      const pp = new ProcessPoisson(2, 1)
      assert.strictEqual(pp.pdf(-1, 1), 0)
    })

    it('should return 1 for x=0 at t=0', () => {
      const pp = new ProcessPoisson(1, 1)
      assert.strictEqual(pp.pdf(0, 0), 1)
    })

    it('should return 0 for x=1 at t=0', () => {
      const pp = new ProcessPoisson(1, 1)
      assert.strictEqual(pp.pdf(1, 0), 0)
    })
  })

  describe('.covariogram()', () => {
    it('should be symmetric', () => {
      const pp = new ProcessPoisson(3, 0.5)
      assert.closeTo(pp.covariogram(2, 5), pp.covariogram(5, 2), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const pp = new ProcessPoisson(3, 0.5)
      assert.closeTo(pp.covariogram(4, 4), pp.variance(4), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const pp = new ProcessPoisson(1, 1)
      assert(Number.isNaN(pp.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const pp = new ProcessPoisson(1, 1)
      assert(Number.isNaN(pp.covariogram(2, -1)))
    })
  })

  describe('.marginal()', () => {
    it('should return a Poisson instance with mean matching mean(t)', () => {
      const pp = new ProcessPoisson(2, 0.5)
      const marginal = pp.marginal(3)
      assert.instanceOf(marginal, Poisson)
      assert.closeTo(marginal.mean(), pp.mean(3), 1e-10)
      assert.closeTo(marginal.variance(), pp.variance(3), 1e-10)
    })

    it('should have pdf matching process.pdf(x, t)', () => {
      const pp = new ProcessPoisson(2, 0.5)
      const marginal = pp.marginal(3)
      assert.closeTo(marginal.pdf(2), pp.pdf(2, 3), 1e-10)
    })

    it('should invert cdf via quantile', () => {
      const pp = new ProcessPoisson(2, 0.5)
      const marginal = pp.marginal(3)
      assert.closeTo(marginal.q(marginal.cdf(2)), 2, 1e-10)
    })

    it('should throw for t = 0', () => {
      const pp = new ProcessPoisson(2, 0.5)
      assert.throws(() => pp.marginal(0), /t must be > 0/)
    })

    it('should throw for t < 0', () => {
      const pp = new ProcessPoisson(2, 0.5)
      assert.throws(() => pp.marginal(-1), /t must be > 0/)
    })
  })

  describe('.fit()', () => {
    it('should recover lambda from a long simulated path across seeds', () => {
      const lambda = 3
      const dt = 0.5
      const n = 20000
      // fit() is the exact MLE: the total count over n*dt observed time is itself exactly
      // Poisson(n*dt*lambda) (sum of n i.i.d. Poisson(lambda*dt) increments), so
      // Var(lambdaHat) = Var(totalCount)/(n*dt)^2 = lambda/(n*dt).
      const tol = K_SIGMA * Math.sqrt(lambda / (n * dt))
      for (const seed of MOMENT_SEEDS) {
        const pp = new ProcessPoisson(lambda, dt)
        pp.seed(seed)
        const fitted = ProcessPoisson.fit(pp.path(n), dt)
        assert.instanceOf(fitted, ProcessPoisson)
        assert.closeTo(fitted.params().lambda, lambda, tol, `seed ${seed}: lambda`)
      }
    })

    it('should default dt to 1', () => {
      const pp = new ProcessPoisson(2, 1)
      pp.seed(1)
      const fitted = ProcessPoisson.fit(pp.path(20000))
      assert.strictEqual(fitted.params().dt, 1)
    })

    it('should throw when path has fewer than 2 states', () => {
      assert.throws(() => ProcessPoisson.fit([0], 1), /at least 2 states/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => ProcessPoisson.fit([0, 1, 2], 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => ProcessPoisson.fit([0, 1, 2], -1), /Invalid parameters/)
    })

    it('should throw when the path decreases', () => {
      assert.throws(() => ProcessPoisson.fit([0, 1, 2, 1], 1), /non-decreasing/)
    })

    it('should throw when no arrivals are observed', () => {
      assert.throws(() => ProcessPoisson.fit([0, 0, 0], 1), /lambda is not positive/)
    })
  })
})

describe('process.PoissonProcess (deprecated alias)', () => {
  it('should be an instance of Poisson and behave identically', () => {
    const pp = withSuppressedWarnings(() => new PoissonProcess(2, 0.5))
    assert(pp instanceof ProcessPoisson)
    assert.strictEqual(pp.mean(3), new ProcessPoisson(2, 0.5).mean(3))
    assert.strictEqual(pp.pdf(1, 3), new ProcessPoisson(2, 0.5).pdf(1, 3))
  })

  it('should emit a deprecation warning naming the replacement', () => {
    let pp
    const warnings = captureWarnings(() => { pp = new PoissonProcess(2, 0.5) })
    assert(pp instanceof ProcessPoisson)
    assert.strictEqual(warnings.length, 1)
    assert.match(warnings[0], /ran\.process\.PoissonProcess is deprecated and will be removed in v1\.33\.0; use ran\.process\.Poisson instead\./)
  })

  it('should have .fit() return a PoissonProcess instance, not a plain Poisson', () => {
    const fitted = withSuppressedWarnings(() => {
      const pp = new PoissonProcess(2, 1)
      pp.seed(1)
      return PoissonProcess.fit(pp.path(5000))
    })
    assert.instanceOf(fitted, PoissonProcess)
  })
})
