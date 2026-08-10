import { assert } from 'chai'
import { describe, it } from 'mocha'
import RandomWalk from '../../src/process/random-walk'
import ShiftedBinomial from '../../src/dist/_shifted-binomial'
import { chiTest } from '../test-utils'
import { MOMENT_SEEDS, K_SIGMA, assertSampleMoments, sampleSteps } from './_helpers'

describe('process.RandomWalk', () => {
  describe('constructor', () => {
    it('should throw on p = 0', () => {
      assert.throws(() => new RandomWalk(0), /Invalid parameters/)
    })

    it('should throw on p = 1', () => {
      assert.throws(() => new RandomWalk(1), /Invalid parameters/)
    })

    it('should throw on p < 0', () => {
      assert.throws(() => new RandomWalk(-0.1), /Invalid parameters/)
    })

    it('should throw on p > 1', () => {
      assert.throws(() => new RandomWalk(1.1), /Invalid parameters/)
    })

    it('should throw on p = NaN', () => {
      assert.throws(() => new RandomWalk(NaN), /Invalid parameters/)
    })

    it('should accept valid probability', () => {
      assert.doesNotThrow(() => new RandomWalk(0.3))
      assert.doesNotThrow(() => new RandomWalk(0.7))
    })

    it('should start at state 0', () => {
      assert.strictEqual(new RandomWalk(0.5).state(), 0)
    })
  })

  describe('path', () => {
    it('should be integer-valued', () => {
      const rw = new RandomWalk(0.5)
      rw.seed(42)
      const path = rw.path(200)
      for (const x of path) {
        assert.strictEqual(x, Math.floor(x))
      }
    })

    it('should change by exactly +1 or -1 at each step', () => {
      const rw = new RandomWalk(0.3)
      rw.seed(7)
      const path = rw.path(100)
      for (let i = 1; i < path.length; i++) {
        const diff = path[i] - path[i - 1]
        assert(diff === 1 || diff === -1, `step ${i} diff = ${diff}`)
      }
    })
  })

  describe('.mean()', () => {
    it('should return 0 for symmetric walk (p=0.5)', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.mean(10), 0)
    })

    it('should return 0 at t = 0', () => {
      const rw = new RandomWalk(0.7)
      assert.strictEqual(rw.mean(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should be reduced by bias (p != 0.5 has less variance than p = 0.5)', () => {
      const sym = new RandomWalk(0.5)
      const biased = new RandomWalk(0.3)
      assert(biased.variance(10) < sym.variance(10))
    })

    it('should return 0 at t = 0', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.variance(-1)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t < 0', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.pdf(0, -1)))
    })

    it('should return NaN for non-integer t', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.pdf(0, 1.5)))
    })

    it('should return 0 for non-integer x', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.pdf(0.5, 4), 0)
    })

    it('should return 0 when |x| > t', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.pdf(3, 2), 0)
    })

    it('should return 0 when x and t have different parity', () => {
      const rw = new RandomWalk(0.5)
      // t=4 (even), x=1 (odd) — unreachable
      assert.strictEqual(rw.pdf(1, 4), 0)
    })

    it('should return 1 at x=0, t=0 (initial point mass)', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.pdf(0, 0), 1)
    })

    it('should return 0 at x=1, t=0', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.pdf(1, 0), 0)
    })

    it('should sum to 1 over all reachable states at t=6', () => {
      const rw = new RandomWalk(0.4)
      let total = 0
      for (let x = -6; x <= 6; x += 2) total += rw.pdf(x, 6)
      // exact rational: sum of all binomial probabilities = 1
      assert.closeTo(total, 1, 1e-10)
    })
  })

  describe('.covariogram()', () => {
    it('should be symmetric', () => {
      const rw = new RandomWalk(0.7)
      assert.closeTo(rw.covariogram(2, 4), rw.covariogram(4, 2), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const rw = new RandomWalk(0.6)
      assert.closeTo(rw.covariogram(5, 5), rw.variance(5), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.covariogram(2, -1)))
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const rw = new RandomWalk(0.5)
      rw.seed(42)
      for (let i = 0; i < 10; i++) rw.next()
      rw.reset()
      assert.strictEqual(rw.state(), 0)
    })
  })

  describe('step distribution', () => {
    it('should have mean and variance matching 2p-1 and 4p(1-p) across seeds', () => {
      const p = 0.7
      const n = 5000
      // exact rational: a single ±1 step has mean = 2p-1, variance = 4p(1-p)
      for (const seed of MOMENT_SEEDS) {
        const rw = new RandomWalk(p)
        rw.seed(seed)
        assertSampleMoments(sampleSteps(rw, n), 2 * p - 1, 4 * p * (1 - p), seed)
      }
    })
  })

  describe('.marginal()', () => {
    it('should have mean and variance matching mean(t) and variance(t)', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(5)
      assert.closeTo(marginal.mean(), rw.mean(5), 1e-10)
      assert.closeTo(marginal.variance(), rw.variance(5), 1e-10)
    })

    it('should have pdf matching process.pdf(x, t) for on-parity x', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(5)
      assert.closeTo(marginal.pdf(3), rw.pdf(3, 5), 1e-10)
      assert.closeTo(marginal.pdf(-1), rw.pdf(-1, 5), 1e-10)
    })

    it('should return 0 for off-parity x, matching process.pdf(x, t)', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(4)
      assert.strictEqual(marginal.pdf(1), rw.pdf(1, 4))
      assert.strictEqual(marginal.pdf(1), 0)
    })

    it('should return 0 outside the support', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(4)
      assert.strictEqual(marginal.pdf(6), 0)
      assert.strictEqual(marginal.pdf(-6), 0)
    })

    it('should invert cdf via quantile', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(5)
      assert.closeTo(marginal.q(marginal.cdf(1)), 1, 1e-10)
      assert.closeTo(marginal.q(marginal.cdf(-3)), -3, 1e-10)
    })

    it('should sample within the support', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(5)
      marginal.seed(42)
      for (const x of marginal.sample(50)) {
        assert(x >= -5 && x <= 5, `x=${x} out of [-5, 5]`)
        assert.strictEqual((5 + x) % 2, 0, `x=${x} has wrong parity`)
      }
    })

    it('should sample values matching the marginal pmf shape (chi-square test)', () => {
      // Bounds/parity checks above pass for any generator that merely stays inside
      // [-n, n] with the right parity -- a flipped p (this.r.next() < this.p.p
      // inverted) or a flipped step count (n - 2*heads instead of 2*heads - n) would
      // still satisfy them undetected. A chi-square goodness-of-fit test against
      // the ShiftedBinomial pmf catches a biased/inverted generator that those
      // checks cannot.
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(5)
      marginal.seed(7)
      const sample = marginal.sample(3000)
      assert(chiTest(sample, x => marginal.pdf(x), 1))
    })

    it('should not throw at t = 0 and represent a point mass at 0', () => {
      const rw = new RandomWalk(0.5)
      const marginal = rw.marginal(0)
      assert.strictEqual(marginal.pdf(0), 1)
      assert.strictEqual(marginal.pdf(1), 0)
    })

    it('should throw for t < 0', () => {
      const rw = new RandomWalk(0.5)
      assert.throws(() => rw.marginal(-1), /non-negative integer/)
    })

    it('should throw for non-integer t', () => {
      const rw = new RandomWalk(0.5)
      assert.throws(() => rw.marginal(1.5), /non-negative integer/)
    })

    it('should support fitting the returned ShiftedBinomial instance to sampled data', () => {
      const rw = new RandomWalk(0.7)
      const marginal = rw.marginal(20)
      marginal.seed(42)
      const fitted = ShiftedBinomial.fit(marginal.sample(2000))
      assert.instanceOf(fitted, ShiftedBinomial)
      assert.strictEqual(fitted.params().n, 20)
      assert.closeTo(fitted.params().p, 0.7, 0.05)
    })

    // ShiftedBinomial is private (decisions/0045) and only ever surfaces as the return value
    // of RandomWalk.marginal(t), so these are its sole regression check for the six generic
    // Distribution methods it inherits without overriding (hazard/survival/lnL/aic/bic/test) --
    // a future change to the base class or to _cdf could silently break any of them otherwise.
    it('should have survival(x) matching 1 - cdf(x)', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(5)
      assert.closeTo(marginal.survival(1), 1 - marginal.cdf(1), 1e-10)
    })

    it('should have hazard(x) matching pdf(x) / survival(x)', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(5)
      assert.closeTo(marginal.hazard(1), marginal.pdf(1) / marginal.survival(1), 1e-10)
    })

    it('should return a finite log-likelihood for a valid support sample', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(5)
      assert.isTrue(Number.isFinite(marginal.lnL([-3, -1, 1, 3, 5])))
    })

    it('should return finite aic/bic for a sampled data set', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(5)
      marginal.seed(1)
      const sample = marginal.sample(50)
      assert.isTrue(Number.isFinite(marginal.aic(sample)))
      assert.isTrue(Number.isFinite(marginal.bic(sample)))
    })

    it('should return the discrete chi-square test result shape for a sampled data set', () => {
      const rw = new RandomWalk(0.6)
      const marginal = rw.marginal(5)
      marginal.seed(7)
      const result = marginal.test(marginal.sample(3000))
      assert.isTrue(result.passed)
      assert.isNumber(result.statistics)
      assert.isNumber(result.pValue)
    })
  })

  describe('.fit()', () => {
    it('should recover p from a long simulated path across seeds', () => {
      const p = 0.65
      const n = 20000
      // exact rational: p_hat is the sample mean of n iid Bernoulli(p) up-step indicators,
      // so Var(p_hat) = p*(1-p)/n exactly (no asymptotic approximation needed).
      const tolP = K_SIGMA * Math.sqrt(p * (1 - p) / n)
      for (const seed of MOMENT_SEEDS) {
        const rw = new RandomWalk(p)
        rw.seed(seed)
        const fitted = RandomWalk.fit(rw.path(n))
        assert.instanceOf(fitted, RandomWalk)
        assert.closeTo(fitted.params().p, p, tolP, `seed ${seed}`)
      }
    })

    it('should throw when path has fewer than 2 states', () => {
      assert.throws(() => RandomWalk.fit([0]), /at least 2 states/)
    })

    it('should throw when path is not an array', () => {
      assert.throws(() => RandomWalk.fit(undefined), /at least 2 states/)
    })

    it('should throw when a step is not +1 or -1', () => {
      assert.throws(() => RandomWalk.fit([0, 2, 1]), /not \+1 or -1/)
    })

    it('should throw when the estimated p is out of (0,1) (all up-steps)', () => {
      assert.throws(() => RandomWalk.fit([0, 1, 2, 3]), /out of \(0,1\)/)
    })

    it('should throw for every 2-state path (a single Bernoulli trial can never yield a ' +
      'fraction strictly between 0 and 1)', () => {
      assert.throws(() => RandomWalk.fit([0, 1]), /out of \(0,1\)/)
      assert.throws(() => RandomWalk.fit([0, -1]), /out of \(0,1\)/)
    })

    it('should succeed at 3 states (the minimum length where p_hat can land strictly inside (0,1))', () => {
      const fitted = RandomWalk.fit([0, 1, 0])
      assert.instanceOf(fitted, RandomWalk)
      // exact rational: p_hat is the fraction of +1 steps, and [0, 1, 0] has increments
      // [+1, -1], so p_hat = 1/2 → mean(t) = t*(2*0.5-1) = 0 for any t, and
      // variance(1) = 4*0.5*(1-0.5)*1 = 1. Stays inline rather than moving to process-cases.js
      // because fit() is a static factory, not an instance method the case file's shape can
      // express.
      assert.strictEqual(fitted.mean(4), 0)
      assert.strictEqual(fitted.variance(1), 1)
    })
  })
})
