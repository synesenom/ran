import { assert } from 'chai'
import { describe, it } from 'mocha'
import OrnsteinUhlenbeck from '../../src/process/ornstein-uhlenbeck'
import { Normal } from '../../src/dist'
import { MOMENT_SEEDS, K_SIGMA, assertSampleMoments, countLogCalls, assertMeanPerStepLnLMatchesGaussianTransition } from './_helpers'

describe('process.OrnsteinUhlenbeck', () => {
  describe('constructor', () => {
    it('should throw on theta = 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(0, 0, 1, 1), /Invalid parameters/)
    })

    it('should throw on theta < 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(-1, 0, 1, 1), /Invalid parameters/)
    })

    it('should throw on sigma = 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(1, 0, 0, 1), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(1, 0, -1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(1, 0, 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(1, 0, 1, -0.5), /Invalid parameters/)
    })

    it('should throw on mu = NaN', () => {
      assert.throws(() => new OrnsteinUhlenbeck(1, NaN, 1, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new OrnsteinUhlenbeck(2, 1, 0.5, 0.1))
    })

    it('should start at state 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 2, 0.5, 0.1)
      assert.strictEqual(ou.state(), 0)
    })
  })

  describe('.mean()', () => {
    it('should return 0 at t=0', () => {
      const ou = new OrnsteinUhlenbeck(1, 5, 1, 0.1)
      assert.strictEqual(ou.mean(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(isNaN(ou.mean(-1)))
    })

    it('should be stable after advancing the simulation', () => {
      const ou = new OrnsteinUhlenbeck(2, 3, 1, 0.1)
      const before = ou.mean(1)
      for (let i = 0; i < 20; i++) ou.next()
      assert.closeTo(ou.mean(1), before, 1e-10)
    })
  })

  describe('.variance()', () => {
    it('should return 0 at t=0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert.strictEqual(ou.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(isNaN(ou.variance(-1)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t = 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(Number.isNaN(ou.pdf(0, 0)))
    })

    it('should return NaN for t < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(Number.isNaN(ou.pdf(0, -1)))
    })
  })

  describe('.covariogram()', () => {
    it('should be symmetric', () => {
      const ou = new OrnsteinUhlenbeck(2, 0, 0.5, 0.1)
      assert.closeTo(ou.covariogram(1, 3), ou.covariogram(3, 1), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const ou = new OrnsteinUhlenbeck(2, 0, 0.5, 0.1)
      assert.closeTo(ou.covariogram(2, 2), ou.variance(2), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(Number.isNaN(ou.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(Number.isNaN(ou.covariogram(2, -1)))
    })
  })

  describe('.marginal()', () => {
    it('should return a Normal distribution with mean and variance matching mean()/variance()', () => {
      const ou = new OrnsteinUhlenbeck(0.5, 3, 2, 0.1)
      const marginal = ou.marginal(2)
      assert.instanceOf(marginal, Normal)
      assert.closeTo(marginal.mean(), ou.mean(2), 1e-10)
      assert.closeTo(marginal.variance(), ou.variance(2), 1e-10)
    })

    it('should match pdf() at a given point', () => {
      const ou = new OrnsteinUhlenbeck(0.5, 3, 2, 0.1)
      const marginal = ou.marginal(2)
      assert.closeTo(marginal.pdf(2), ou.pdf(2, 2), 1e-10)
    })

    it('should round-trip quantile(cdf(x)) = x, exercising the Distribution API beyond pdf/mean/variance', () => {
      const ou = new OrnsteinUhlenbeck(0.5, 3, 2, 0.1)
      const marginal = ou.marginal(2)
      assert.closeTo(marginal.q(marginal.cdf(2)), 2, 1e-10)
    })

    it('should throw for t = 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert.throws(() => ou.marginal(0), /t must be > 0/)
    })

    it('should throw for t < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert.throws(() => ou.marginal(-1), /t must be > 0/)
    })
  })

  describe('.lnL()', () => {
    it('should have a mean per-step log-density matching the known transition law (CLT tolerance)', () => {
      const theta = 0.5
      const mu = 3
      const sigma = 2
      const dt = 0.1
      const n = 2000
      const ou = new OrnsteinUhlenbeck(theta, mu, sigma, dt)
      ou.seed(42)
      const path = ou.path(n)
      const decay = Math.exp(-theta * dt)
      const noise = sigma * Math.sqrt((1 - decay * decay) / (2 * theta))
      assertMeanPerStepLnLMatchesGaussianTransition(ou, path, noise)
    })

    it('should not recompute log(noise) per step (this.c.logNoise is precomputed at construction)', () => {
      const ou = new OrnsteinUhlenbeck(0.8, 0.5, 0.6, 0.25)
      const path = [1.0, 0.9, 0.6, 0.8, 0.7, 0.95, 0.65, 0.85, 0.75, 0.9]
      const steps = path.length - 1
      // Only the 2π normalization term is logged per step once noise's log is cached in
      // this.c.logNoise; a Math.log(noise) recomputation per step would double this count.
      assert.strictEqual(countLogCalls(() => ou.lnL(path)), steps)
    })
  })

  describe('.fit()', () => {
    it('should recover theta, mu, and sigma from a long simulated path across seeds', () => {
      const theta = 0.8
      const mu = 2
      const sigma = 1.5
      const dt = 0.2
      const n = 30000
      // fit() is OLS on the exact AR(1) transition y = a + b*x + eps, b = exp(-theta*dt),
      // a = mu*(1-b), eps ~ N(0, s2) with s2 = sigma^2*(1-b^2)/(2*theta). Tolerances below are
      // the classical AR(1)-OLS asymptotic standard errors (Hamilton, "Time Series Analysis",
      // eq. 8.2.16: sqrt(n)(bHat-b) -> N(0, 1-b^2)) propagated through theta/mu/sigma's
      // back-substitution formulas via the delta method, replacing the old flat 15% band
      // (which was loose enough to pass even with a systematic back-substitution bug — see
      // solutions/testing/2026-07-28-1601-flat-tolerance-masks-estimator-bugs.md).
      const b = Math.exp(-theta * dt)
      const s2 = sigma * sigma * (1 - b * b) / (2 * theta)
      const varB = (1 - b * b) / n
      // theta = -ln(b)/dt, d(theta)/d(b) = -1/(b*dt)
      const varTheta = varB / (b * b * dt * dt)
      // mu = a/(1-b); propagating Var(a), Var(b), and Cov(a,b) from OLS through the delta
      // method makes every mu^2 term cancel, leaving this parameter-free closed form.
      const varMu = s2 / (n * (1 - b) * (1 - b))
      // sigma^2 = s2*2*theta/(1-b^2) = s2*(-2*ln(b)/dt)/(1-b^2); by Cochran's theorem s2 and b
      // are exactly independent (conditional on the path) for Gaussian OLS, so their variance
      // contributions add without a covariance cross-term. varS2 uses the same chi-squared-type
      // sampling-variance form as assertSampleMoments's tolVariance (expected*sqrt(2/(n-1))).
      const dSigma2dS2 = 2 * theta / (1 - b * b)
      const dSigma2dB = -(2 * s2 / dt) * ((1 - b * b) / b + 2 * b * Math.log(b)) / ((1 - b * b) * (1 - b * b))
      const varS2 = 2 * s2 * s2 / n
      const varSigma2 = dSigma2dS2 * dSigma2dS2 * varS2 + dSigma2dB * dSigma2dB * varB
      const varSigma = varSigma2 / (4 * sigma * sigma)
      const tolTheta = K_SIGMA * Math.sqrt(varTheta)
      const tolMu = K_SIGMA * Math.sqrt(varMu)
      const tolSigma = K_SIGMA * Math.sqrt(varSigma)
      for (const seed of MOMENT_SEEDS) {
        const ou = new OrnsteinUhlenbeck(theta, mu, sigma, dt)
        ou.seed(seed)
        const fitted = OrnsteinUhlenbeck.fit(ou.path(n), dt)
        assert.instanceOf(fitted, OrnsteinUhlenbeck)
        assert.closeTo(fitted.params().theta, theta, tolTheta, `seed ${seed}: theta`)
        assert.closeTo(fitted.params().mu, mu, tolMu, `seed ${seed}: mu`)
        assert.closeTo(fitted.params().sigma, sigma, tolSigma, `seed ${seed}: sigma`)
      }
    })

    it('should default dt to 1', () => {
      const ou = new OrnsteinUhlenbeck(0.5, 1, 1, 1)
      ou.seed(1)
      const fitted = OrnsteinUhlenbeck.fit(ou.path(20000))
      assert.strictEqual(fitted.params().dt, 1)
    })

    it('should throw when path has fewer than 4 states', () => {
      assert.throws(() => OrnsteinUhlenbeck.fit([0, 1, 2], 1), /at least 4 states/)
    })

    it('should throw when the AR(1) slope estimate is out of (0,1)', () => {
      // A perfectly linear path drives the OLS slope to exactly 1 (X_{n+1}-X_n constant),
      // outside the valid exp(-theta*dt) in (0,1) range for any theta, dt > 0.
      assert.throws(() => OrnsteinUhlenbeck.fit([0, 1, 2, 3, 4, 5], 1), /AR\(1\) slope/)
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 2, 0.5, 0.1)
      for (let i = 0; i < 10; i++) ou.next()
      ou.reset()
      assert.strictEqual(ou.state(), 0)
    })
  })

  describe('stationarity', () => {
    it('should converge to stationary mean mu and variance sigma^2/(2*theta) across seeds', () => {
      const theta = 2; const mu = 3; const sigma = 1; const dt = 0.1
      // exact rational: OU stationary distribution is N(mu, sigma^2/(2*theta))
      const stationaryVariance = sigma * sigma / (2 * theta)
      for (const seed of MOMENT_SEEDS) {
        const ou = new OrnsteinUhlenbeck(theta, mu, sigma, dt)
        ou.seed(seed)
        for (let i = 0; i < 500; i++) ou.next()
        // lag-1 autocorrelation is exp(-theta*dt)=exp(-0.2)≈0.82; thin by 20 to get
        // independent draws (lag-20 autocorrelation ≈ 0.018)
        const samples = []
        for (let i = 0; i < 20000; i++) {
          ou.next()
          if (i % 20 === 0) samples.push(ou.state())
        }
        assertSampleMoments(samples, mu, stationaryVariance, seed)
      }
    })
  })
})
