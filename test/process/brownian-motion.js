import { assert } from 'chai'
import { describe, it } from 'mocha'
import BrownianMotion from '../../src/process/brownian-motion'
import { Normal } from '../../src/dist'
import { MOMENT_SEEDS, K_SIGMA, assertSampleMoments, sampleSteps, countLogCalls, assertMeanPerStepLnLMatchesGaussianTransition } from './_helpers'

describe('process.BrownianMotion', () => {
  describe('constructor', () => {
    it('should throw on sigma = 0', () => {
      assert.throws(() => new BrownianMotion(0, 0, 1), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new BrownianMotion(0, -1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new BrownianMotion(0, 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new BrownianMotion(0, 1, -0.5), /Invalid parameters/)
    })

    it('should throw on mu = NaN', () => {
      assert.throws(() => new BrownianMotion(NaN, 1, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new BrownianMotion(0, 1, 1))
      assert.doesNotThrow(() => new BrownianMotion(-2, 0.5, 0.01))
    })

    it('should start at state 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.strictEqual(bm.state(), 0)
    })
  })

  describe('.mean()', () => {
    it('should return 0 for zero drift at any t', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.strictEqual(bm.mean(3), 0)
      assert.strictEqual(bm.mean(100), 0)
    })

    it('should return 0 at t=0', () => {
      const bm = new BrownianMotion(1, 1, 1)
      assert.strictEqual(bm.mean(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return 0 at t=0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.strictEqual(bm.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.variance(-1)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t = 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.pdf(0, 0)))
    })

    it('should return NaN for t < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.pdf(0, -1)))
    })
  })

  describe('.covariogram()', () => {
    it('should be symmetric', () => {
      const bm = new BrownianMotion(0, 2, 1)
      assert.closeTo(bm.covariogram(1, 4), bm.covariogram(4, 1), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const bm = new BrownianMotion(0, 2, 1)
      assert.closeTo(bm.covariogram(3, 3), bm.variance(3), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.covariogram(2, -1)))
    })
  })

  describe('.marginal()', () => {
    it('should return a Normal distribution with mean and variance matching mean()/variance()', () => {
      const bm = new BrownianMotion(0.5, 2, 1)
      const marginal = bm.marginal(3)
      assert.instanceOf(marginal, Normal)
      assert.closeTo(marginal.mean(), bm.mean(3), 1e-10)
      assert.closeTo(marginal.variance(), bm.variance(3), 1e-10)
    })

    it('should match pdf() at a given point', () => {
      const bm = new BrownianMotion(0.5, 2, 1)
      const marginal = bm.marginal(3)
      assert.closeTo(marginal.pdf(1), bm.pdf(1, 3), 1e-10)
    })

    it('should round-trip quantile(cdf(x)) = x, exercising the Distribution API beyond pdf/mean/variance', () => {
      const bm = new BrownianMotion(0.5, 2, 1)
      const marginal = bm.marginal(3)
      assert.closeTo(marginal.q(marginal.cdf(1)), 1, 1e-10)
    })

    it('should throw for t = 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.throws(() => bm.marginal(0), /t must be > 0/)
    })

    it('should throw for t < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.throws(() => bm.marginal(-1), /t must be > 0/)
    })
  })

  describe('.lnL()', () => {
    it('should have a mean per-step log-density matching the known transition law (CLT tolerance)', () => {
      const mu = 0.1
      const sigma = 1
      const dt = 1
      const n = 2000
      const bm = new BrownianMotion(mu, sigma, dt)
      bm.seed(42)
      const path = bm.path(n)
      assertMeanPerStepLnLMatchesGaussianTransition(bm, path, sigma * Math.sqrt(dt))
    })

    it('should not recompute log(sigmaDt) per step (this.c.logSigmaDt is precomputed at construction)', () => {
      const bm = new BrownianMotion(0.3, 1.2, 0.5)
      const path = [0, 0.4, 1.1, 0.7, 0.2, 0.9, 0.5, 1.3, 0.8, 0.6]
      const steps = path.length - 1
      // Only the 2π normalization term is logged per step once sigmaDt's log is cached in
      // this.c.logSigmaDt; a Math.log(sigmaDt) recomputation per step would double this count.
      assert.strictEqual(countLogCalls(() => bm.lnL(path)), steps)
    })
  })

  describe('.fit()', () => {
    it('should recover mu and sigma from a long simulated path across seeds', () => {
      const mu = 0.3
      const sigma = 1.2
      const dt = 0.5
      const n = 20000
      // CLT tolerance for the exact increment-based MLE: mu_hat ~ N(mu, sigma^2/(n*dt)),
      // sigma_hat's variance via the delta method on the sample-variance's own CLT tolerance.
      const tolMu = K_SIGMA * sigma / Math.sqrt(n * dt)
      const tolSigma = K_SIGMA * sigma * Math.sqrt(1 / (2 * (n - 1)))
      for (const seed of MOMENT_SEEDS) {
        const bm = new BrownianMotion(mu, sigma, dt)
        bm.seed(seed)
        const fitted = BrownianMotion.fit(bm.path(n), dt)
        assert.instanceOf(fitted, BrownianMotion)
        assert.closeTo(fitted.params().mu, mu, tolMu, `seed ${seed}`)
        assert.closeTo(fitted.params().sigma, sigma, tolSigma, `seed ${seed}`)
      }
    })

    it('should default dt to 1', () => {
      const bm = new BrownianMotion(0.1, 1, 1)
      bm.seed(1)
      const fitted = BrownianMotion.fit(bm.path(5000))
      assert.strictEqual(fitted.params().dt, 1)
    })

    it('should throw when path has fewer than 3 states', () => {
      assert.throws(() => BrownianMotion.fit([0, 1], 1), /at least 3 states/)
    })
  })

  describe('.path()', () => {
    it('should have length n+1', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.strictEqual(bm.path(10).length, 11)
    })

    it('first element should be initial state 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.strictEqual(bm.path(5)[0], 0)
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      for (let i = 0; i < 10; i++) bm.next()
      bm.reset()
      assert.strictEqual(bm.state(), 0)
    })
  })

  describe('increments', () => {
    it('should have mean and variance matching mu*dt and sigma^2*dt across seeds', () => {
      const mu = 0.1
      const sigma = 1.5
      const dt = 0.5
      const n = 5000
      // exact rational: BM increment ~ N(mu*dt, sigma^2*dt) by definition of the SDE
      for (const seed of MOMENT_SEEDS) {
        const bm = new BrownianMotion(mu, sigma, dt)
        bm.seed(seed)
        assertSampleMoments(sampleSteps(bm, n), mu * dt, sigma * sigma * dt, seed)
      }
    })
  })
})
