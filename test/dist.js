import { assert } from 'chai'
import { before, describe, it } from 'mocha'
import { float } from '../src/core'
import * as dist from '../src/dist'
import PreComputed from '../src/dist/_pre-computed'
import Distribution from '../src/dist/_distribution'

describe('dist', () => {
  // Base class
  describe('Distribution', () => {
    const invalid = new dist.InvalidDiscrete()

    describe('.sample()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.sample()
        }, 'Distribution._generator() is not implemented')
      })
    })

    describe('.pdf()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.pdf(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.cdf()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.cdf(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.q()', () => {
      it('should throw for p < 0 or p > 1', () => {
        assert.throws(() => invalid.q(-1), Error)
        assert.throws(() => invalid.q(2), Error)
      })
    })

    describe('.q()', () => {
      it('should return support boundary if p === 0 or p === 1', () => {
        assert(invalid.q(0) === invalid.support()[0].value)
        assert(invalid.q(1) === invalid.support()[1].value)
      })
    })

    describe('._qEstimateRoot()', () => {
      it('returns NaN when bracket cannot be found (degenerate equal-bound open support)', () => {
        // Support [5, 5] (both open, both equal) collapses delta to 0, so a0 === b0 and bracket() returns undefined.
        class DegenerateContinuous extends Distribution {
          constructor () {
            super('continuous', 0)
            this.s = [{ value: 5, closed: false }, { value: 5, closed: false }]
          }

          _pdf () { return 0 }
          _cdf () { return 0.5 }
        }
        const d = new DegenerateContinuous()
        assert(Number.isNaN(d.q(0.5)))
      })
    })

    describe('.survive()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.survival(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.hazard()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.hazard(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.cHazard()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.cHazard(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.lnPdf()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.lnPdf(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.lnL()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.lnL([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.test()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.test([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.aic()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.aic([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.bic()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.bic([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.bounded()', () => {
      it('should return "bounded" for Beta (finite lower and upper)', () => {
        assert.equal(new dist.Beta(1, 1).bounded(), 'bounded')
      })

      it('should return "lower" for Exponential (finite lower, infinite upper)', () => {
        assert.equal(new dist.Exponential(1).bounded(), 'lower')
      })

      it('should return "unbounded" for Normal (infinite lower and upper)', () => {
        assert.equal(new dist.Normal(0, 1).bounded(), 'unbounded')
      })

      it('should return "bounded" for Binomial (finite discrete support)', () => {
        assert.equal(new dist.Binomial(10, 0.5).bounded(), 'bounded')
      })

      it('should return "lower" for Poisson (semi-infinite discrete support)', () => {
        assert.equal(new dist.Poisson(3).bounded(), 'lower')
      })
    })

    describe('.params()', () => {
      it('Distribution.params() returns the parameter object for a non-Categorical distribution', () => {
        const d = new dist.Normal(2, 3)
        const p = d.params()
        assert.strictEqual(p.mu, 2)
        assert.strictEqual(p.sigma, 3)
      })

      it('Categorical.params() returns { weights } only', () => {
        const d = new dist.Categorical([0.3, 0.7], 0)
        const p = d.params()
        assert.deepEqual(p.weights, [0.3, 0.7])
        assert.strictEqual(p.n, undefined)
        assert.strictEqual(p.min, undefined)
      })

      it('Bernoulli.params() returns { p }', () => {
        const d = new dist.Bernoulli(0.7)
        assert.deepEqual(d.params(), { p: 0.7 })
      })

      it('Binomial.params() returns { n, p }', () => {
        const d = new dist.Binomial(10, 0.3)
        assert.deepEqual(d.params(), { n: 10, p: 0.3 })
      })

      it('Hypergeometric.params() returns { N, K, n }', () => {
        const d = new dist.Hypergeometric(10, 5, 3)
        assert.deepEqual(d.params(), { N: 10, K: 5, n: 3 })
      })

      it('Soliton.params() returns { N }', () => {
        const d = new dist.Soliton(5)
        assert.deepEqual(d.params(), { N: 5 })
      })

      it('Zipf.params() returns { s, N }', () => {
        const d = new dist.Zipf(2, 50)
        assert.deepEqual(d.params(), { s: 2, N: 50 })
      })

      it('ZipfMandelbrot.params() returns { N, s, q }', () => {
        const d = new dist.ZipfMandelbrot(100, 2, 1)
        assert.deepEqual(d.params(), { N: 100, s: 2, q: 1 })
      })

      it('BetaBinomial.params() returns { n, alpha, beta }', () => {
        const d = new dist.BetaBinomial(5, 2, 3)
        assert.deepEqual(d.params(), { n: 5, alpha: 2, beta: 3 })
      })

      it('NegativeHypergeometric.params() returns { N, K, r }', () => {
        const d = new dist.NegativeHypergeometric(10, 5, 2)
        assert.deepEqual(d.params(), { N: 10, K: 5, r: 2 })
      })

      it('Rademacher.params() returns {}', () => {
        assert.deepEqual(new dist.Rademacher().params(), {})
      })

      it('Bernoulli.fit().params().p recovers planted value within tolerance', () => {
        const data = new dist.Bernoulli(0.7).seed(42).sample(500)
        const result = dist.Bernoulli.fit(data)
        assert(Math.abs(result.params().p - 0.7) < 0.05)
      })

      it('Zipf.fit().params() recovers planted s within tolerance', () => {
        const data = new dist.Zipf(2, 50).seed(42).sample(200)
        const result = dist.Zipf.fit(data)
        assert(Math.abs(result.params().s - 2) < 0.3)
        assert(result.params().N >= 10)
      })
    })
  })

  describe('PreComputed', () => {
    class PreComputedTestClass extends PreComputed {}
    const preComputed = new PreComputedTestClass()

    it('should throw error if _pk is not overridden', () => {
      assert.throws(() => {
        preComputed._pk()
      }, 'PreComputed._pk() is not implemented')
    })

    it('should clamp _cdf to 1 on cache-hit path when PMFs sum to 1+epsilon', () => {
      // Subclass whose PMFs sum to slightly above 1 (simulating floating-point rounding)
      class OverflowPMF extends PreComputed {
        _pk () { return 0.5 + 1e-15 }
      }
      const d = new OverflowPMF()
      // Warm up cache by accessing index 1 (fills cdfTable[0] and cdfTable[1])
      d._cdf(1)
      // cdfTable[0] = 0.5+eps, cdfTable[1] ≈ 1 + 2eps > 1; re-reading from cache must still return ≤ 1
      assert.isAtMost(d._cdf(0), 1)
      assert.isAtMost(d._cdf(1), 1)
    })

    it('_generator returns NaN when all alias tables are exhausted (zero-probability PMF)', () => {
      // _pk returns 0 for every k, so every alias table always routes to the overflow slot (TABLE_SIZE).
      // After MAX_NUMBER_OF_TABLES tables the do-while exits without sampling, and must return NaN not undefined.
      class ZeroMassDist extends PreComputed {
        _pk () { return 0 }
      }
      const d = new ZeroMassDist()
      assert(Number.isNaN(d._generator()))
    })
  })

  describe('.fit() Categorical subclasses', () => {
    it('Binomial.fit should recover PMF close to planted values', () => {
      const data = new dist.Binomial(10, 0.3).seed(42).sample(200)
      const result = dist.Binomial.fit(data)
      assert(result instanceof dist.Binomial)
      assert(Number.isFinite(result.pdf(3)) && result.pdf(3) > 0)
      assert(Math.abs(result.pdf(3) - new dist.Binomial(10, 0.3).pdf(3)) < 0.05)
    })

    it('Zipf.fit should return a usable Zipf instance', () => {
      const data = new dist.Zipf(2, 50).seed(42).sample(200)
      const result = dist.Zipf.fit(data)
      assert(result instanceof dist.Zipf)
      assert(Number.isFinite(result.pdf(1)) && result.pdf(1) > 0)
      assert(Math.abs(result.pdf(1) - new dist.Zipf(2, 50).pdf(1)) < 0.1)
    })

    it('ZipfMandelbrot.fit should return a usable ZipfMandelbrot instance', () => {
      const data = new dist.ZipfMandelbrot(20, 2, 1).seed(42).sample(300)
      const result = dist.ZipfMandelbrot.fit(data)
      assert(result instanceof dist.ZipfMandelbrot)
      assert(Number.isFinite(result.pdf(1)) && result.pdf(1) > 0)
      assert(Math.abs(result.pdf(1) - new dist.ZipfMandelbrot(20, 2, 1).pdf(1)) < 0.1)
    })

    it('Hypergeometric.fit should return a usable Hypergeometric instance', () => {
      const data = new dist.Hypergeometric(20, 10, 8).seed(42).sample(200)
      const result = dist.Hypergeometric.fit(data)
      assert(result instanceof dist.Hypergeometric)
      assert(Number.isFinite(result.pdf(4)) && result.pdf(4) > 0)
    })

    it('NegativeHypergeometric.fit should return a usable NegativeHypergeometric instance', () => {
      const data = new dist.NegativeHypergeometric(20, 10, 3).seed(42).sample(200)
      const result = dist.NegativeHypergeometric.fit(data)
      assert(result instanceof dist.NegativeHypergeometric)
      assert(Number.isFinite(result.pdf(2)) && result.pdf(2) > 0)
    })

    it('BetaBinomial.fit should return a usable BetaBinomial instance', () => {
      const data = new dist.BetaBinomial(10, 2, 3).seed(42).sample(200)
      const result = dist.BetaBinomial.fit(data)
      assert(result instanceof dist.BetaBinomial)
      assert(Number.isFinite(result.pdf(4)) && result.pdf(4) > 0)
    })
  })

  // Degenerate is not covered by dist-cases.js (special-cased below) — verify constructor throws on missing params per issue #50.
  describe('Degenerate', () => {
    describe('constructor', () => {
      it('should throw error if no parameters are provided', () => {
        assert.throws(() => new dist.Degenerate())
      })
    })
  })

  // Kolmogorov: open lower boundary — x=0 is outside the support (x>0) and must return 0.
  describe('Kolmogorov', () => {
    const k = new dist.Kolmogorov()

    describe('.pdf()', () => {
      it('should return 0 at the open lower boundary x = 0', () => {
        assert.equal(k.pdf(0), 0)
      })
    })

    describe('.cdf()', () => {
      it('should return 0 at the open lower boundary x = 0', () => {
        assert.equal(k.cdf(0), 0)
      })
    })

    describe('.survival()', () => {
      it('should return 1 at the open lower boundary x = 0', () => {
        assert.equal(k.survival(0), 1)
      })
    })
  })

  // Base class helper: _qEstimateWalk.
  describe('Distribution._qEstimateWalk', () => {
    // Poisson(5) reference values:
    //   ppf(0.1) = 2   cdf(2)=0.12465  cdf(1)=0.04043
    //   ppf(0.5) = 5   cdf(5)=0.61596  cdf(4)=0.44049
    //   ppf(0.9) = 8   cdf(8)=0.93191  cdf(7)=0.86663
    let d
    before(() => { d = new dist.Poisson(5) })

    it('should walk up from a start below the quantile', () => {
      assert.strictEqual(d._qEstimateWalk(0.9, 0), 8)
    })

    it('should walk down from a start above the quantile', () => {
      assert.strictEqual(d._qEstimateWalk(0.1, 20), 2)
    })

    it('should return immediately when start already satisfies the invariant', () => {
      assert.strictEqual(d._qEstimateWalk(0.5, 5), 5)
    })

    it('should walk up from a negative start', () => {
      assert.strictEqual(d._qEstimateWalk(0.5, -10), 5)
    })

    it('should return lower support boundary when p=0', () => {
      assert.strictEqual(d._qEstimateWalk(0, 5), 0)
    })

    it('should return upper support boundary when p=1', () => {
      assert.strictEqual(d._qEstimateWalk(1, 5), Infinity)
    })
  })

  // Degenerate distribution.
  describe('Degenerate', () => {
    describe('.sample()', () => {
      describe('random parameters', () => {
        it('should generate values with Degenerate distribution', () => {
          const x0 = float()
          const degenerate = new dist.Degenerate(x0)
          degenerate.sample(10).forEach(d => {
            assert(d === x0)
          })
        })
      })
    })

    describe('.pdf(), .cdf()', () => {
      describe('random parameters', () => {
        it('differentiating cdf should give pdf', () => {
          const x0 = float()
          const degenerate = new dist.Degenerate(x0)
          assert.equal(degenerate.pdf(x0), 1)
          assert.equal(degenerate.pdf(x0 + Math.random() * 2 - 1), 0)
          assert.equal(degenerate.cdf(x0 - Math.random()), 0)
          assert.equal(degenerate.cdf(x0), 1)
          assert.equal(degenerate.cdf(x0 + Math.random()), 1)
        })
      })
    })
  })

  // Lindley: AIC/BIC parameter-count regression — this.k must be 1 so the penalty is not silently dropped.
  // Guard against reverting super('continuous', 1) back to super('continuous', arguments.length),
  // which would set k=0 if a default were ever reintroduced to the constructor.
  describe('Lindley', () => {
    const sample = [0.1, 0.5, 1.0, 1.5, 2.0, 0.3, 0.8, 1.2, 2.5, 0.6]
    const d = new dist.Lindley(1)

    it('should throw when constructed without arguments', () => {
      assert.throws(() => new dist.Lindley())
    })

    it('should have paramCount k=1', () => {
      assert.strictEqual(d.k, 1)
    })

    it('aic() should include the parameter penalty (k=1)', () => {
      // AIC = 2*(k - lnL); with k=1 the penalty is 2. k=0 would make aic() return a lower value.
      assert.strictEqual(d.aic(sample), 2 * (1 - d.lnL(sample)))
    })

    it('bic() should include the parameter penalty (k=1)', () => {
      assert.strictEqual(d.bic(sample), Math.log(sample.length) * 1 - 2 * d.lnL(sample))
    })
  })

  // Mielke: AIC/BIC parameter-count regression — this.k must be 2, not 3 inherited from Dagum.
  describe('Mielke', () => {
    const sample = [0.1, 0.5, 1.0, 1.5, 2.0, 0.3, 0.8, 1.2, 2.5, 0.6]
    const d = new dist.Mielke(2, 2)

    it('should have paramCount k=2', () => {
      assert.strictEqual(d.k, 2)
    })

    it('aic() should include the parameter penalty (k=2)', () => {
      // AIC = 2*(k - lnL); with k=2 the penalty is 4. k=3 (inherited from Dagum) over-counts by 2.
      assert.strictEqual(d.aic(sample), 2 * (2 - d.lnL(sample)))
    })

    it('bic() should include the parameter penalty (k=2)', () => {
      assert.strictEqual(d.bic(sample), Math.log(sample.length) * 2 - 2 * d.lnL(sample))
    })
  })

  // Multi-level inheritance parameter-count regressions (issue #510). Each subclass inherits the wrong
  // this.k from a parent further up the chain unless it overrides; a wrong k silently distorts aic()/bic().
  const paramCountCases = [
    { name: 'Weibull', ctor: () => new dist.Weibull(1, 1), k: 2, inherited: '1 from Exponential' },
    { name: 'DoubleWeibull', ctor: () => new dist.DoubleWeibull(1, 1), k: 2, inherited: '1 from Weibull' },
    { name: 'ExponentiatedWeibull', ctor: () => new dist.ExponentiatedWeibull(1, 1, 1), k: 3, inherited: '2 from Weibull' },
    { name: 'Rayleigh', ctor: () => new dist.Rayleigh(1), k: 1, inherited: '2 from Weibull' },
    { name: 'Chi2', ctor: () => new dist.Chi2(4), k: 1, inherited: '2 from Gamma' },
    { name: 'Chi', ctor: () => new dist.Chi(4), k: 1, inherited: '2 from Gamma via Chi2' },
    { name: 'MaxwellBoltzmann', ctor: () => new dist.MaxwellBoltzmann(1), k: 1, inherited: '2 from Gamma' },
    { name: 'GeneralizedGamma', ctor: () => new dist.GeneralizedGamma(1, 1, 1), k: 3, inherited: '2 from Gamma' },
    { name: 'GeneralizedNormal', ctor: () => new dist.GeneralizedNormal(0, 1, 2), k: 3, inherited: '2 from Gamma via GeneralizedGamma' },
    { name: 'HalfGeneralizedNormal', ctor: () => new dist.HalfGeneralizedNormal(1, 2), k: 2, inherited: '3 from GeneralizedNormal' },
    { name: 'LogGamma', ctor: () => new dist.LogGamma(1, 1, 0), k: 3, inherited: '2 from Gamma' }
  ]
  describe('Davis', () => {
    it('survival/hazard/cHazard below support return 1/0/0', () => {
      const d = new dist.Davis(1, 1, 2.5)
      // x well below support (tests the x < mu path)
      assert.strictEqual(d.survival(0.5), 1)
      assert.strictEqual(d.hazard(0.5), 0)
      assert.strictEqual(d.cHazard(0.5), 0)
      // x exactly at the open lower boundary mu (tests the x === mu path of x <= mu guard)
      assert.strictEqual(d.survival(1), 1)
      assert.strictEqual(d.hazard(1), 0)
      assert.strictEqual(d.cHazard(1), 0)
    })
  })

  paramCountCases.forEach(({ name, ctor, k, inherited }) => {
    describe(`${name} parameter count`, () => {
      const sample = [0.1, 0.5, 1.0, 1.5, 2.0, 0.3, 0.8, 1.2, 2.5, 0.6]
      const d = ctor()

      it(`should have paramCount k=${k}, not the ${inherited}`, () => {
        assert.strictEqual(d.k, k)
      })

      it(`aic() should use the corrected parameter penalty (k=${k})`, () => {
        assert.strictEqual(d.aic(sample), 2 * (k - d.lnL(sample)))
      })

      it(`bic() should use the corrected parameter penalty (k=${k})`, () => {
        assert.strictEqual(d.bic(sample), Math.log(sample.length) * k - 2 * d.lnL(sample))
      })
    })
  })
})
