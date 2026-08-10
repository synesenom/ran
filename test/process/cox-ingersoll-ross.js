import { assert } from 'chai'
import { describe, it } from 'mocha'
import CoxIngersollRoss from '../../src/process/cox-ingersoll-ross'
import { Gamma } from '../../src/dist'
import { MOMENT_SEEDS, assertSampleMoments } from './_helpers'

describe('process.CoxIngersollRoss', () => {
  describe('constructor', () => {
    it('should throw on kappa = 0', () => {
      assert.throws(() => new CoxIngersollRoss(0, 1, 1, 1), /Invalid parameters/)
    })

    it('should throw on kappa < 0', () => {
      assert.throws(() => new CoxIngersollRoss(-1, 1, 1, 1), /Invalid parameters/)
    })

    it('should throw on theta = 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, 0, 1, 1), /Invalid parameters/)
    })

    it('should throw on theta < 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, -1, 1, 1), /Invalid parameters/)
    })

    it('should throw on sigma = 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, 1, 0, 1), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, 1, -1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, 1, 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, 1, 1, -0.5), /Invalid parameters/)
    })

    it('should throw on kappa = NaN', () => {
      assert.throws(() => new CoxIngersollRoss(NaN, 1, 1, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new CoxIngersollRoss(2, 1, 0.5, 0.1))
    })

    it('should not throw when Feller condition is not met', () => {
      // 2*0.5*1 = 1 <= 4 = sigma^2; Feller not satisfied, but only a warning
      assert.doesNotThrow(() => new CoxIngersollRoss(0.5, 1, 2, 1))
    })

    it('should start at state 0', () => {
      const cir = new CoxIngersollRoss(2, 1, 0.5, 0.1)
      assert.strictEqual(cir.state(), 0)
    })
  })

  describe('.mean()', () => {
    it('should return 0 at t=0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert.strictEqual(cir.mean(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const cir = new CoxIngersollRoss(1, 1, 1, 1)
      assert(isNaN(cir.mean(-1)))
    })

    it('should be stable after advancing the simulation', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      const before = cir.mean(1)
      for (let i = 0; i < 20; i++) cir.next()
      assert.closeTo(cir.mean(1), before, 1e-10)
    })
  })

  describe('.variance()', () => {
    it('should return 0 at t=0', () => {
      const cir = new CoxIngersollRoss(1, 1, 1, 1)
      assert.strictEqual(cir.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const cir = new CoxIngersollRoss(1, 1, 1, 1)
      assert(isNaN(cir.variance(-1)))
    })
  })

  describe('positivity', () => {
    it('should produce non-negative paths when Feller condition holds', () => {
      // 2*kappa*theta = 2*2*1 = 4 > 1 = sigma^2; Feller condition met
      const cir = new CoxIngersollRoss(2, 1, 1, 0.01)
      cir.seed(0)
      const path = cir.path(10000)
      assert(path.every(x => x >= 0))
    })
  })

  describe('stationarity', () => {
    it('should converge to stationary mean theta and variance sigma^2*theta/(2*kappa) across seeds', () => {
      const kappa = 2; const theta = 1.5; const sigma = 0.5; const dt = 0.01
      const burnInSteps = 500
      const m = 3000
      // exact rational: CIR stationary distribution is Gamma with mean theta and variance
      // sigma^2*theta/(2*kappa); burn-in time = burnInSteps*dt = 5 with kappa=2 makes the
      // finite-time bias (~exp(-kappa*burnInTime) = exp(-10)) negligible relative to the
      // sampling tolerance
      const stationaryVariance = sigma * sigma * theta / (2 * kappa)
      for (const seed of MOMENT_SEEDS) {
        const cir = new CoxIngersollRoss(kappa, theta, sigma, dt)
        cir.seed(seed)
        const paths = cir.ensemble(m, burnInSteps)
        const samples = paths.map(path => path[burnInSteps])
        assertSampleMoments(samples, theta, stationaryVariance, seed)
      }
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const cir = new CoxIngersollRoss(2, 1, 0.5, 0.1)
      for (let i = 0; i < 10; i++) cir.next()
      cir.reset()
      assert.strictEqual(cir.state(), 0)
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t = 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert(Number.isNaN(cir.pdf(1, 0)))
    })

    it('should return NaN for t < 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert(Number.isNaN(cir.pdf(1, -1)))
    })

    it('should return 0 for x < 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert.strictEqual(cir.pdf(-0.1, 0.5), 0)
    })

    it('should return 0 for x = 0 when Feller condition holds (alpha > 1)', () => {
      // kappa=2, theta=3, sigma=1: alpha = 2*kappa*theta/sigma^2 = 12 > 1
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert.strictEqual(cir.pdf(0, 0.5), 0)
    })

    it('should be stable after advancing the simulation', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      const before = cir.pdf(1.0, 0.5)
      for (let i = 0; i < 20; i++) cir.next()
      assert.closeTo(cir.pdf(1.0, 0.5), before, 1e-10)
    })
  })

  describe('.covariogram()', () => {
    it('should return NaN for s < 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert(Number.isNaN(cir.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert(Number.isNaN(cir.covariogram(2, -1)))
    })

    it('should be symmetric', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert.closeTo(cir.covariogram(1, 3), cir.covariogram(3, 1), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      // mpmath mp.dps=50: theta*sigma^2/(2*kappa)*(1-exp(-kappa*t))^2 at t=2 ->
      // 0.72277813863782561343853900993447378244661507377008. Documentation only — the assertion
      // below is the structural cov(t,t) = variance(t) identity, not a reference-value check.
      assert.closeTo(cir.covariogram(2, 2), cir.variance(2), 1e-10)
    })

    it('should return 0 at s=0 or t=0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      // exact rational: min(s,t)=0 so (1-exp(0))^2 = 0
      assert.strictEqual(cir.covariogram(0, 2), 0)
      assert.strictEqual(cir.covariogram(2, 0), 0)
    })
  })

  describe('.marginal()', () => {
    it('should return a Gamma distribution matching pdf() at a given point', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      const marginal = cir.marginal(0.5)
      assert.instanceOf(marginal, Gamma)
      assert.closeTo(marginal.pdf(0.5), cir.pdf(0.5, 0.5), 1e-10)
      assert.closeTo(marginal.pdf(2.0), cir.pdf(2.0, 0.5), 1e-10)
    })

    it('should have mean and variance matching mean()/variance()', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      const marginal = cir.marginal(1)
      assert.closeTo(marginal.mean(), cir.mean(1), 1e-10)
      assert.closeTo(marginal.variance(), cir.variance(1), 1e-10)
    })

    it('should match pdf() at x=0 when alpha <= 1 (Feller condition violated)', () => {
      // alpha = 2*kappa*theta/sigma^2 = 2*1*0.4/4 = 0.2 < 1
      const cir = new CoxIngersollRoss(1, 0.4, 2, 0.1)
      const marginal = cir.marginal(0.5)
      assert.strictEqual(marginal.pdf(0), cir.pdf(0, 0.5))
    })

    it('should round-trip quantile(cdf(x)) = x, exercising the Distribution API beyond pdf/mean/variance', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      const marginal = cir.marginal(1)
      assert.closeTo(marginal.q(marginal.cdf(2)), 2, 1e-10)
    })

    it('should throw for t = 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert.throws(() => cir.marginal(0), /t must be > 0/)
    })

    it('should throw for t < 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert.throws(() => cir.marginal(-1), /t must be > 0/)
    })
  })

  describe('.fit()', () => {
    it('should recover kappa, theta, and sigma from a long simulated path across seeds', () => {
      const kappa = 2
      const theta = 3
      const sigma = 1
      const dt = 0.01
      const n = 100000
      // Stage 1 (kappa, theta) regresses X_{n+1} on X_n exactly like OrnsteinUhlenbeck.fit() —
      // same b = exp(-kappa*dt), a = theta*(1-b) back-substitution — so Hamilton's classical
      // AR(1)-OLS asymptotic slope variance (sqrt(n)(bHat-b) -> N(0, 1-b^2)) applies to kappa via
      // the same delta method OU uses for its theta. Unlike OU, CIR's one-step conditional
      // variance is heteroskedastic (proportional to X_n, from the sigma*sqrt(X) diffusion term)
      // rather than OU's flat s2; evaluating the exact conditional variance (the same
      // Var[X_{n+1}|X_n] = X_n*sigma^2/kappa*(b-b^2) + theta*sigma^2/(2*kappa)*(1-b)^2 that
      // fit()'s stage 2 estimates) at the stationary mean X_n = theta gives the representative
      // constant-variance analogue of OU's s2, used below for theta's tolerance.
      const b = Math.exp(-kappa * dt)
      const s2 = theta * sigma * sigma / (2 * kappa) * (1 - b * b)
      const varB = (1 - b * b) / n
      // kappa = -ln(b)/dt, d(kappa)/d(b) = -1/(b*dt) — identical delta method to OU's theta.
      const varKappa = varB / (b * b * dt * dt)
      // theta = a/(1-b) — same OLS delta-method form as OU's varMu, with CIR's heteroskedastic
      // s2 (above) standing in for OU's constant one.
      const varTheta = s2 / (n * (1 - b) * (1 - b))
      // sigma^2 = alpha*kappa/(b-b^2), where alpha is stage 2's OLS slope of e_i^2 on X_i. Unlike
      // OU's s2Hat (a plain sample mean of homoskedastic squared Gaussian residuals), alpha_hat
      // is itself a regression slope on heteroskedastic, non-Gaussian e_i^2, so its sampling
      // variance needs the OLS-slope sandwich form, not a chi-squared sample-variance one. dt is
      // small here (kappa*dt = 0.02), so the noncentral chi-squared driving each step has
      // noncentrality far exceeding its degrees of freedom (~1000x at X = theta) and is close to
      // Gaussian by the standard noncentral-chi-squared-to-normal limit; under that
      // approximation e_i^2's residual variance around its mean s2 is ~2*s2^2 (a Gaussian
      // fourth-moment), giving the same sandwich form used for varB: Var(alpha_hat) ~
      // 2*s2^2/(n*Var(X)), Var(X) = the stationary variance theta*sigma^2/(2*kappa). We
      // conservatively double this estimate: e_i^2's true distribution (noncentral-chi-squared-
      // driven, not exactly Gaussian) has excess kurtosis this approximation doesn't capture, and
      // CLS is documented to be less efficient than exact MLE on this second-moment stage.
      const vStat = theta * sigma * sigma / (2 * kappa)
      const varAlpha = 2 * (2 * s2 * s2 / (n * vStat))
      const alpha = sigma * sigma / kappa * (b - b * b)
      const dSigma2dAlpha = kappa / (b - b * b)
      // Stage 1's kappa/b uncertainty also feeds into sigma^2 = alpha*kappa/(b-b^2); propagated
      // the same way as OU's dSigma2dB (kappa = -ln(b)/dt substituted in before differentiating).
      const dSigma2dB = alpha * ((b - 1) + Math.log(b) * (1 - 2 * b)) / (dt * (b - b * b) * (b - b * b))
      const varSigma2 = dSigma2dAlpha * dSigma2dAlpha * varAlpha + dSigma2dB * dSigma2dB * varB
      const varSigma = varSigma2 / (4 * sigma * sigma)
      // These three MOMENT_SEEDS are fixed and deterministic — unlike a test that resamples a
      // fresh seed every run, they never change, so K_SIGMA=8's enormous margin (guarding against
      // flakiness on arbitrary future seeds) buys nothing extra here. K=5 still corresponds to a
      // ~5.7e-7 two-sided tail probability under the CLT normal approximation above — vastly more
      // than three already-known, fixed outcomes need — while giving a materially tighter band
      // than the old flat 20% (verified empirically to hold with comfortable margin, including
      // against a 300-seed sweep well beyond the 3 seeds actually asserted below).
      const K = 5
      const tolKappa = K * Math.sqrt(varKappa)
      const tolTheta = K * Math.sqrt(varTheta)
      const tolSigma = K * Math.sqrt(varSigma)
      for (const seed of MOMENT_SEEDS) {
        const cir = new CoxIngersollRoss(kappa, theta, sigma, dt)
        cir.seed(seed)
        const fitted = CoxIngersollRoss.fit(cir.path(n), dt)
        assert.instanceOf(fitted, CoxIngersollRoss)
        assert.closeTo(fitted.params().kappa, kappa, tolKappa, `seed ${seed}: kappa`)
        assert.closeTo(fitted.params().theta, theta, tolTheta, `seed ${seed}: theta`)
        assert.closeTo(fitted.params().sigma, sigma, tolSigma, `seed ${seed}: sigma`)
      }
    })

    it('should default dt to 1', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.01)
      cir.seed(1)
      const fitted = CoxIngersollRoss.fit(cir.path(20000))
      assert.strictEqual(fitted.params().dt, 1)
    })

    it('should throw when path has fewer than 4 states', () => {
      assert.throws(() => CoxIngersollRoss.fit([1, 2, 3], 1), /at least 4 states/)
    })

    it('should throw when the AR(1) slope estimate is out of (0,1)', () => {
      assert.throws(() => CoxIngersollRoss.fit([1, 5, 2, 5, 3, 5], 1), /AR\(1\) slope/)
    })

    it('should throw when the estimated sigma^2 is non-positive', () => {
      assert.throws(() => CoxIngersollRoss.fit([5, 4, 3, 2, 1, 2], 1), /sigma\^2 is non-positive/)
    })
  })
})
