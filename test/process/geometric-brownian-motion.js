import { assert } from 'chai'
import { describe, it } from 'mocha'
import GeometricBrownianMotion from '../../src/process/geometric-brownian-motion'
import { LogNormal } from '../../src/dist'
import { MOMENT_SEEDS, K_SIGMA, assertSampleMoments, sampleSteps, countLogCalls } from './_helpers'

describe('process.GeometricBrownianMotion', () => {
  describe('constructor', () => {
    it('should throw on sigma = 0', () => {
      assert.throws(() => new GeometricBrownianMotion(0, 0, 1), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new GeometricBrownianMotion(0, -1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new GeometricBrownianMotion(0, 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new GeometricBrownianMotion(0, 1, -0.5), /Invalid parameters/)
    })

    it('should throw on mu = NaN', () => {
      assert.throws(() => new GeometricBrownianMotion(NaN, 1, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new GeometricBrownianMotion(0, 1, 1))
      assert.doesNotThrow(() => new GeometricBrownianMotion(0.05, 0.2, 0.01))
    })

    it('should start at state 1', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.strictEqual(gbm.state(), 1)
    })
  })

  describe('.path()', () => {
    it('should have length n+1', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.strictEqual(gbm.path(10).length, 11)
    })

    it('first element should be 1', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.strictEqual(gbm.path(5)[0], 1)
    })

    it('all path values should remain positive', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      gbm.seed(42)
      const path = gbm.path(500)
      assert(path.every(v => v > 0))
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 1', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      for (let i = 0; i < 10; i++) gbm.next()
      gbm.reset()
      assert.strictEqual(gbm.state(), 1)
    })
  })

  describe('.mean()', () => {
    it('should return 1 at t=0', () => {
      const gbm = new GeometricBrownianMotion(0.1, 0.2, 1)
      assert.strictEqual(gbm.mean(0), 1)
    })

    it('should return NaN for t < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.mean(-1)))
    })

    it('should be stable after advancing the simulation', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.2, 1)
      const before = gbm.mean(2)
      for (let i = 0; i < 20; i++) gbm.next()
      assert.closeTo(gbm.mean(2), before, 1e-10)
    })
  })

  describe('.variance()', () => {
    it('should return 0 at t=0', () => {
      const gbm = new GeometricBrownianMotion(0.1, 0.2, 1)
      assert.strictEqual(gbm.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.variance(-1)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t = 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.pdf(1, 0)))
    })

    it('should return NaN for t < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.pdf(1, -1)))
    })

    it('should return 0 for x = 0 (outside log-normal support)', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.strictEqual(gbm.pdf(0, 1), 0)
    })

    it('should return 0 for x < 0 (outside log-normal support)', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.strictEqual(gbm.pdf(-1, 1), 0)
    })
  })

  describe('.covariogram()', () => {
    it('should be symmetric', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.2, 1)
      assert.closeTo(gbm.covariogram(1, 4), gbm.covariogram(4, 1), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.3, 1)
      assert.closeTo(gbm.covariogram(2, 2), gbm.variance(2), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.covariogram(2, -1)))
    })
  })

  describe('.marginal()', () => {
    it('should return a LogNormal distribution matching pdf() at a given point', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.2, 1)
      const marginal = gbm.marginal(2)
      assert.instanceOf(marginal, LogNormal)
      assert.closeTo(marginal.pdf(1.5), gbm.pdf(1.5, 2), 1e-10)
    })

    it('should have mean and variance matching mean()/variance()', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.2, 1)
      const marginal = gbm.marginal(2)
      assert.closeTo(marginal.mean(), gbm.mean(2), 1e-10)
      assert.closeTo(marginal.variance(), gbm.variance(2), 1e-10)
    })

    it('should round-trip quantile(cdf(x)) = x, exercising the Distribution API beyond pdf/mean/variance', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.2, 1)
      const marginal = gbm.marginal(2)
      assert.closeTo(marginal.q(marginal.cdf(1.5)), 1.5, 1e-10)
    })

    it('should throw for t = 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.throws(() => gbm.marginal(0), /t must be > 0/)
    })

    it('should throw for t < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.throws(() => gbm.marginal(-1), /t must be > 0/)
    })
  })

  describe('.lnL()', () => {
    it('should return -Infinity, not throw, when the path visits a non-positive state', () => {
      const gbm = new GeometricBrownianMotion(0.1, 0.25, 0.5)
      assert.strictEqual(gbm.lnL([1, -1]), -Infinity)
    })

    it('should return -Infinity, not NaN, when the non-positive state is not the last one', () => {
      const gbm = new GeometricBrownianMotion(0.1, 0.25, 0.5)
      assert.strictEqual(gbm.lnL([1, -1, 2]), -Infinity)
    })

    it('should match the known transition law plus the observed path Jacobian (CLT tolerance)', () => {
      const mu = 0.05
      const sigma = 0.2
      const dt = 1
      const n = 2000
      const gbm = new GeometricBrownianMotion(mu, sigma, dt)
      gbm.seed(42)
      const path = gbm.path(n)
      const noise = sigma * Math.sqrt(dt)
      // Each step's residual z = (log(x_{i+1}/x_i)-drift)/noise is exactly N(0,1) by construction,
      // so E[-0.5*z^2] = -0.5 exactly (Var(z^2) = 2). The -log(x_{i+1}) Jacobian term is not part
      // of that randomness — it's summed directly from the actually observed path values.
      let logJacobianSum = 0
      for (let i = 0; i < n; i++) logJacobianSum += Math.log(path[i + 1])
      const expectedTotal = n * (-0.5 - Math.log(noise) - 0.5 * Math.log(2 * Math.PI)) - logJacobianSum
      const tol = K_SIGMA * Math.sqrt(n / 2)
      assert.closeTo(gbm.lnL(path), expectedTotal, tol)
    })

    it('should not recompute log(noise) per step (this.c.logNoise is precomputed at construction)', () => {
      const gbm = new GeometricBrownianMotion(0.1, 0.25, 0.5)
      const path = [1.0, 1.2, 0.9, 1.5, 1.1, 1.3, 0.95, 1.4, 1.05, 1.25]
      const steps = path.length - 1
      // Each step already logs log(xNext/xPrev), log(2π), and log(xNext) (the Jacobian term);
      // a Math.log(noise) recomputation per step would push this to 4 calls/step instead of 3.
      assert.strictEqual(countLogCalls(() => gbm.lnL(path)), 3 * steps)
    })
  })

  describe('.fit()', () => {
    it('should recover mu and sigma from a long simulated path across seeds', () => {
      const mu = 0.05
      const sigma = 0.3
      const dt = 0.5
      const n = 20000
      // Same CLT-derived tolerance style as BrownianMotion.fit(), applied to log-returns
      // (which are i.i.d. N((mu-sigma^2/2)*dt, sigma^2*dt), same as BM increments).
      const tolSigma = K_SIGMA * sigma * Math.sqrt(1 / (2 * (n - 1)))
      // mu_hat = mean(logReturns)/dt + sigma_hat^2/2, so its tolerance also absorbs sigma_hat's error
      const tolMu = K_SIGMA * sigma / Math.sqrt(n * dt) + tolSigma * sigma
      for (const seed of MOMENT_SEEDS) {
        const gbm = new GeometricBrownianMotion(mu, sigma, dt)
        gbm.seed(seed)
        const fitted = GeometricBrownianMotion.fit(gbm.path(n), dt)
        assert.instanceOf(fitted, GeometricBrownianMotion)
        assert.closeTo(fitted.params().sigma, sigma, tolSigma, `seed ${seed}`)
        assert.closeTo(fitted.params().mu, mu, tolMu, `seed ${seed}`)
      }
    })

    it('should default dt to 1', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.2, 1)
      gbm.seed(1)
      const fitted = GeometricBrownianMotion.fit(gbm.path(5000))
      assert.strictEqual(fitted.params().dt, 1)
    })

    it('should throw when path has fewer than 3 states', () => {
      assert.throws(() => GeometricBrownianMotion.fit([1, 1.1], 1), /at least 3 states/)
    })

    it('should throw when path contains a non-positive state', () => {
      assert.throws(() => GeometricBrownianMotion.fit([1, 1.1, 0, 1.2], 1), /positive states/)
    })
  })

  describe('log-returns', () => {
    it('should have mean and variance matching the GBM/Itô log-return identity across seeds', () => {
      const mu = 0.05
      const sigma = 0.2
      const dt = 1
      const n = 5000
      // exact rational: log(X_{t+dt}/X_t) ~ N((mu - sigma^2/2)*dt, sigma^2*dt) by Itô's lemma,
      // independent of the sampler implementation
      const meanLR = (mu - 0.5 * sigma * sigma) * dt
      const varLR = sigma * sigma * dt
      for (const seed of MOMENT_SEEDS) {
        const gbm = new GeometricBrownianMotion(mu, sigma, dt)
        gbm.seed(seed)
        const logReturns = sampleSteps(gbm, n, (curr, prev) => Math.log(curr / prev))
        assertSampleMoments(logReturns, meanLR, varLR, seed)
      }
    })
  })
})
