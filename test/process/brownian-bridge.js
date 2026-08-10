import { assert } from 'chai'
import { describe, it } from 'mocha'
import BrownianBridge from '../../src/process/brownian-bridge'
import { Normal } from '../../src/dist'
import { MOMENT_SEEDS, K_SIGMA, assertSampleMoments, sampleResetSteps } from './_helpers'

describe('process.BrownianBridge', () => {
  describe('constructor', () => {
    it('should throw on sigma = 0', () => {
      assert.throws(() => new BrownianBridge(0, 1, 0.1), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new BrownianBridge(-1, 1, 0.1), /Invalid parameters/)
    })

    it('should throw on T = 0', () => {
      assert.throws(() => new BrownianBridge(1, 0, 0.1), /Invalid parameters/)
    })

    it('should throw on T < 0', () => {
      assert.throws(() => new BrownianBridge(1, -1, 0.1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new BrownianBridge(1, 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new BrownianBridge(1, 1, -0.1), /Invalid parameters/)
    })

    it('should throw on sigma = NaN', () => {
      assert.throws(() => new BrownianBridge(NaN, 1, 0.1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new BrownianBridge(1, 1, 0.1))
      assert.doesNotThrow(() => new BrownianBridge(0.5, 2, 0.5))
    })

    it('should start at state 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.state(), 0)
    })
  })

  describe('terminal value', () => {
    it('should return 0 exactly at terminal step N = T/dt', () => {
      const T = 1
      const dt = 0.1
      const N = Math.round(T / dt)
      const bb = new BrownianBridge(1, T, dt)
      bb.seed(42)
      for (let i = 0; i < N; i++) bb.next()
      assert.strictEqual(bb.state(), 0)
    })

    it('should stay at 0 after terminal time', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      bb.seed(42)
      const N = 10
      for (let i = 0; i < N + 5; i++) bb.next()
      assert.strictEqual(bb.state(), 0)
    })
  })

  describe('.reset()', () => {
    it('should restore initial state and time index', () => {
      const T = 1
      const dt = 0.1
      const N = Math.round(T / dt)
      const bb = new BrownianBridge(1, T, dt)
      bb.seed(42)
      for (let i = 0; i < N; i++) bb.next()
      bb.reset()
      assert.strictEqual(bb.state(), 0)
      for (let i = 0; i < N; i++) bb.next()
      assert.strictEqual(bb.state(), 0)
    })
  })

  describe('.path()', () => {
    it('should return N+1 states starting from 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      const path = bb.path(10)
      assert.strictEqual(path.length, 11)
      assert.strictEqual(path[0], 0)
    })

    it('should end at 0 at the terminal step', () => {
      const T = 1
      const dt = 0.1
      const N = Math.round(T / dt)
      const bb = new BrownianBridge(1, T, dt)
      bb.seed(42)
      const path = bb.path(N)
      assert.strictEqual(path[N], 0)
    })

    it('should not mutate the current state or time index', () => {
      const T = 1
      const dt = 0.1
      const N = Math.round(T / dt)
      const bb = new BrownianBridge(1, T, dt)
      bb.seed(42)
      for (let i = 0; i < 5; i++) bb.next()
      const stateBefore = bb.state()
      bb.path(N)
      assert.strictEqual(bb.state(), stateBefore)
      // Remaining 5 steps should still reach 0
      for (let i = 0; i < 5; i++) bb.next()
      assert.strictEqual(bb.state(), 0)
    })
  })

  describe('.mean()', () => {
    it('should return 0 for t >= 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.mean(0), 0)
      assert.strictEqual(bb.mean(0.5), 0)
      assert.strictEqual(bb.mean(1), 0)
      assert.strictEqual(bb.mean(2), 0)
    })

    it('should return NaN for t < 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert(Number.isNaN(bb.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return 0 at t=0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.variance(0), 0)
    })

    it('should return 0 at t=T', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.variance(1), 0)
    })

    it('should return 0 for t > T', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.variance(2), 0)
    })

    it('should return NaN for t < 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert(Number.isNaN(bb.variance(-1)))
    })
  })

  describe('.covariogram()', () => {
    it('should be symmetric', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.closeTo(bb.covariogram(0.5, 1.5), bb.covariogram(1.5, 0.5), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const sigma = 2; const T = 1
      const bb = new BrownianBridge(sigma, T, 0.1)
      assert.closeTo(bb.covariogram(0.4, 0.4), bb.variance(0.4), 1e-10)
    })

    it('should return 0 for s > T', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.covariogram(1.5, 0.5), 0)
    })

    it('should return 0 for t > T', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.covariogram(0.5, 1.5), 0)
    })

    it('should return 0 at t = T', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.covariogram(0.5, 1), 0)
    })

    it('should return NaN for s < 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert(Number.isNaN(bb.covariogram(-0.5, 0.5)))
    })

    it('should return NaN for t < 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert(Number.isNaN(bb.covariogram(0.5, -0.5)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t < 0', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert(Number.isNaN(bb.pdf(0, -1)))
    })

    it('should return Infinity at x=0 when t=0 (point mass at origin)', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(0, 0), Infinity)
    })

    it('should return 0 at x≠0 when t=0', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(1, 0), 0)
    })

    it('should return Infinity at x=0 when t=T (pinned to 0)', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(0, 2), Infinity)
    })

    it('should return 0 at x≠0 when t=T', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(1, 2), 0)
    })

    it('should return Infinity at x=0 for t > T', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(0, 3), Infinity)
    })

    it('should return 0 at x≠0 for t > T', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(1, 3), 0)
    })

    it('should be symmetric around 0 (pdf(-x, t) = pdf(x, t))', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.closeTo(bb.pdf(-1, 1), bb.pdf(1, 1), 1e-10)
    })
  })

  describe('.marginal()', () => {
    it('should return a Normal distribution with variance matching variance()', () => {
      const bb = new BrownianBridge(2, 4, 0.1)
      const marginal = bb.marginal(2)
      assert.instanceOf(marginal, Normal)
      assert.strictEqual(marginal.mean(), 0)
      assert.closeTo(marginal.variance(), bb.variance(2), 1e-10)
    })

    it('should match pdf() at a given point', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      const marginal = bb.marginal(1)
      assert.closeTo(marginal.pdf(1), bb.pdf(1, 1), 1e-10)
    })

    it('should round-trip quantile(cdf(x)) = x, exercising the Distribution API beyond pdf/mean/variance', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      const marginal = bb.marginal(1)
      assert.closeTo(marginal.q(marginal.cdf(1)), 1, 1e-10)
    })

    it('should throw for t = 0', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.throws(() => bb.marginal(0), /0 < t < T/)
    })

    it('should throw for t = T', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.throws(() => bb.marginal(2), /0 < t < T/)
    })

    it('should throw for t > T', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.throws(() => bb.marginal(3), /0 < t < T/)
    })
  })

  describe('increments', () => {
    it('should have mean and variance matching sigma^2*dt*(T-dt)/T at t=0 across seeds', () => {
      const sigma = 1.5
      const T = 100
      const dt = 1
      const n = 5000
      // exact rational: standard Brownian bridge variance formula sigma^2*t*(T-t)/T evaluated at t=dt
      const expectedVariance = sigma * sigma * dt * (T - dt) / T
      for (const seed of MOMENT_SEEDS) {
        const bb = new BrownianBridge(sigma, T, dt)
        bb.seed(seed)
        assertSampleMoments(sampleResetSteps(bb, n), 0, expectedVariance, seed)
      }
    })
  })

  describe('.fit()', () => {
    it('should recover sigma from a long simulated path across seeds', () => {
      const sigma = 1.4
      const T = 2000
      const dt = 1
      const N = T / dt
      // Every step's conditional draw is exact (no discretization error), so the MLE's
      // sigma^2 estimate is exactly sigma^2/(N-1) times a chi-square(N-1) variate; propagating
      // its variance (2*sigma^4/(N-1)) through the delta method gives sigma_hat's own tolerance.
      const tolSigma = K_SIGMA * sigma * Math.sqrt(1 / (2 * (N - 1)))
      for (const seed of MOMENT_SEEDS) {
        const bb = new BrownianBridge(sigma, T, dt)
        bb.seed(seed)
        const fitted = BrownianBridge.fit(bb.path(N), T, dt)
        assert.instanceOf(fitted, BrownianBridge)
        assert.closeTo(fitted.params().sigma, sigma, tolSigma, `seed ${seed}`)
      }
    })

    it('should default dt to 0.1', () => {
      const bb = new BrownianBridge(1, 10, 0.1)
      bb.seed(1)
      const fitted = BrownianBridge.fit(bb.path(100), 10)
      assert.strictEqual(fitted.params().dt, 0.1)
    })

    it('should throw when T is not > 0', () => {
      assert.throws(() => BrownianBridge.fit([0, 0], -1, 1), /Invalid parameters/)
    })

    it('should throw when dt is not > 0', () => {
      assert.throws(() => BrownianBridge.fit([0, 0], 10, 0), /Invalid parameters/)
    })

    it('should throw when T/dt is less than 2', () => {
      assert.throws(() => BrownianBridge.fit([0, 0], 1, 1), /at least 2/)
    })

    it('should succeed at exactly T/dt = 2 (the minimum estimable case)', () => {
      const sigma = 1.5
      const T = 1
      const dt = 0.5
      const bb = new BrownianBridge(sigma, T, dt)
      bb.seed(1)
      const fitted = BrownianBridge.fit(bb.path(2), T, dt)
      assert.instanceOf(fitted, BrownianBridge)
      assert.isAbove(fitted.params().sigma, 0)
    })

    it('should throw when path is not an array', () => {
      assert.throws(() => BrownianBridge.fit(null, 10, 1), /exactly T\/dt \+ 1 states/)
    })

    it('should throw when path length does not match T/dt + 1', () => {
      assert.throws(() => BrownianBridge.fit([0, 1, 0], 4, 1), /exactly T\/dt \+ 1 states/)
    })
  })
})
