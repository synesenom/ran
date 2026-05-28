import { assert } from 'chai'
import { before, describe, it } from 'mocha'
import { adTest, chiTest, Tests, checkRefVals, checkQuantileVals } from './test-utils'
import { float } from '../src/core'
import * as dist from '../src/dist'
import PreComputed from '../src/dist/_pre-computed'
import continuousCases from './dist-cases-continuous'
import discreteCases from './dist-cases-discrete'

const testCases = [...continuousCases, ...discreteCases]

// Constants.
const PRECISION = 1e-10
const SAMPLE_SIZE = 10000
// Anderson-Darling has ~1.5–2× higher GoF power than KS at the same α, so half
// the sample suffices for the same false-positive rate on the continuous
// goodness-of-fit assertion. SAMPLE_SIZE is unchanged for paths that still rely
// on KS or chi² (Distribution.test() and chiTest). See issue #184.
const AD_SAMPLE_SIZE = 5000
// α = 0.001 matches the historical false-positive rate of the previous KS check
// (its one-sided statistic with the two-sided 1.628/√N band rejects at an
// effective rate well below the nominal α = 0.01).
// See solutions/testing/2026-05-19-1132-gof-test-swap-effective-alpha-empirical-calibration.md
const AD_ALPHA = 0.001

// Unit test suite.
const UnitTests = {
  constructor (tc) {
    it('should throw error if params are invalid', () => {
      tc.invalidParams.forEach(params => {
        assert.throws(() => new dist[tc.name](...params))
      })
    })
  },

  seed (tc) {
    const sampleSize = 100

    it('should give the same sample for the same seed', () => {
      const self = new dist[tc.name](...tc.cases[0].params())
      const s = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
      self.seed(s)
      const values1 = self.sample(sampleSize)
      self.seed(s)
      const values2 = self.sample(sampleSize)
      assert(values1.reduce((acc, d, i) => acc && Math.abs(d - values2[i]) < PRECISION, true))
    })

    it('should give different samples for different seeds', () => {
      const self = new dist[tc.name](...tc.cases[0].params())
      self.seed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
      const values1 = self.sample(sampleSize)
      self.seed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
      const values2 = self.sample(sampleSize)
      assert(values1.reduce((acc, d, i) => acc || d !== values2[i], true))
    })
  },

  loadAndSave (tc) {
    const sampleSize = 100

    it('loaded state should continue where it was saved at', () => {
      // Create generator and seed
      const generator = new dist[tc.name](...tc.cases[0].params())
      const s = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
      const cut = Math.floor(sampleSize / 3)

      // Generate full sample
      const values = generator.sample(sampleSize)

      // Reset generator, create two sub samples
      generator.seed(s)
      const values1 = generator.sample(cut)
      const state = generator.save()
      generator.seed(0)
      generator.load(state)
      const values2 = generator.sample(sampleSize - cut)

      // Compare samples
      assert(values1.concat(values2).reduce((acc, d, i) => acc || d === values[i], true))
    })

    it('loaded state should copy full state of generator', () => {
      // Create seeded generator
      const generator1 = new dist[tc.name](...tc.cases[0].params())
      generator1.seed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

      // Generate original sample
      generator1.sample(10)
      const state = generator1.save()
      const values1 = generator1.sample(10)

      // Generate new default generator and load state
      const generator2 = new dist[tc.name](...tc.cases[0].params()).load(state)
      const values2 = generator2.sample(10)

      // Compare samples
      assert(values1.reduce((acc, d, i) => acc || d !== values2[i], true) === true)
    })
  },

  analytical (tc) {
    // Test cases
    const cases = tc.cases.map(c => ({
      name: c.name || 'random parameters',
      generate: () => new dist[tc.name](...c.params()),
      refVals: c.refVals,
      quantileVals: c.quantileVals,
      symmetry: c.symmetry,
      symmetryDiscrete: c.symmetryDiscrete
    }))

    cases.forEach(c => {
      describe(c.name, () => {
        it('pdf should be non-negative', () => {
          Tests.pdfRange(c.generate())
        })

        it('cdf should be in [0, 1]', () => {
          Tests.cdfRange(c.generate())
        })

        it('cdf should be non-decreasing', () => {
          Tests.cdfMonotonicity(c.generate())
        })

        it('pdf (pmf) should be the differential (difference) of cdf', () => {
          Tests.cdf2pdf(c.generate())
        })

        it('quantile should be within support', () => {
          Tests.qRange(c.generate())
        })

        it('quantile should be non-decreasing', () => {
          Tests.qMonotonicity(c.generate())
        })

        it('quantile should satisfy Galois inequalities', () => {
          Tests.qGalois(c.generate())
        })

        it('quantile should round-trip through cdf', () => {
          Tests.quantileRoundtrip(c.generate())
        })

        if (c.refVals) {
          it('pdf and cdf should match per-case reference values', () => {
            checkRefVals(c.generate(), c.refVals)
          })
        }

        if (c.quantileVals) {
          it('quantile should match per-case reference values', () => {
            checkQuantileVals(c.generate(), c.quantileVals)
          })
        }

        if (c.symmetry !== undefined) {
          it('pdf and cdf should be symmetric around the center', () => {
            Tests.symmetry(c.generate(), c.symmetry)
          })
        }

        if (c.symmetryDiscrete !== undefined) {
          it('pmf and cdf should be symmetric around the center (discrete)', () => {
            Tests.symmetryDiscrete(c.generate(), c.symmetryDiscrete)
          })
        }
      })
    })

    if (tc.refVals) {
      it('pdf and cdf should match reference values', () => {
        const generator = new dist[tc.name](...tc.cases[0].params())
        checkRefVals(generator, tc.refVals)
      })
    }

    if (tc.quantileVals) {
      it('quantile should match reference values', () => {
        const generator = new dist[tc.name](...tc.cases[0].params())
        checkQuantileVals(generator, tc.quantileVals)
      })
    }
  },

  sample (tc) {
    // Test cases
    const cases = (tc.sampleParams ?? tc.cases).map(c => ({
      name: c.name || 'random parameters',
      generate: () => new dist[tc.name](...c.params())
    }))
    // per-distribution override for GoF assertion only; support-range check always uses SAMPLE_SIZE
    // See solutions/testing/2026-05-22-1820-per-distribution-gof-sample-size-override.md
    const n = tc.sampleSize

    cases.forEach(c => {
      describe(c.name, () => {
        it('sample should be within the range of the support', () => {
          // Generate sample.
          const dist = c.generate()
          const supp = dist.support()
          const sample = dist.sample(SAMPLE_SIZE)

          // Check if values are within range.
          sample.forEach(d => {
            assert(Number.isFinite(d) && !isNaN(d), `x = ${d}`)
            assert(d >= supp[0].value, `Below lower bound: ${d} < ${supp[0].value}`)
            assert(d <= supp[1].value, `Above upper bound: ${d} > ${supp[1].value}`)
          })
        })

        it('sample values should be distributed correctly', () => {
          for (const s of [0, 42, 12345]) {
            const generator = c.generate()
            generator.seed(s)
            assert(generator.type() === 'continuous'
              ? adTest(generator.sample(n ?? AD_SAMPLE_SIZE), x => generator.cdf(x), AD_ALPHA)
              // c=0: parameters are known, not estimated from data — see solutions/testing/2026-05-16-1915-alias-table-chi2-df-correction.md
              : chiTest(generator.sample(n ?? SAMPLE_SIZE), x => generator.pdf(x), 0), `seed ${s}`)
          }
        })
      })
    })
  },

  test (tc) {
    // Test cases — skip sampling-expensive parameter sets the same way .sample() does.
    const cases = (tc.sampleParams ?? tc.cases).map(c => ({
      name: c.name || 'random parameters',
      gen: () => {
        const p = c.params()
        // console.log(p)
        return new dist[tc.name](...p)
      }
    }))

    // Go through text cases.
    cases.forEach(c => {
      describe(c.name, () => {
        it('should pass for own test', () => {
          for (const s of (tc.testSeeds ?? [0, 42, 12345])) {
            const generator = c.gen()
            generator.seed(s)
            assert(generator.test(generator.sample(SAMPLE_SIZE)).passed, `seed ${s}`)
          }
        })

        it('should reject foreign distribution', () => {
          for (const s of [0, 42, 12345]) {
            const generator = c.gen()
            generator.seed(s)
            const sample = generator.sample(SAMPLE_SIZE)
            let foreign
            if (tc.foreign) {
              foreign = new dist[tc.foreign.generator](...tc.foreign.params(sample))
            } else {
              // spread on 10k elements overflows the call stack on some engines; reduce is safe at any size
              const lo = sample.reduce((a, d) => d < a ? d : a, Infinity)
              const hi = sample.reduce((a, d) => d > a ? d : a, -Infinity)
              foreign = generator.type() === 'continuous'
                ? new dist.Uniform(lo, hi)
                : new dist.DiscreteUniform(lo, lo < hi ? hi : lo + 1)
            }
            assert(!foreign.test(sample).passed, `seed ${s}`)
          }
        })
      })
    })
  }
}

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
      it('should return undefined if p < 0 or p > 1', () => {
        assert(typeof invalid.q(-1) === 'undefined')
        assert(typeof invalid.q(2) === 'undefined')
      })
    })

    describe('.q()', () => {
      it('should return support boundary if p === 0 or p === 1', () => {
        assert(invalid.q(0) === invalid.support()[0].value)
        assert(invalid.q(1) === invalid.support()[1].value)
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

    describe('.fit()', () => {
      it('Normal.fit should return a Normal instance', () => {
        const result = dist.Normal.fit([1, 2, 3, 4, 5])
        assert(result instanceof dist.Normal)
      })

      it('Normal.fit should recover mu close to sample mean', () => {
        const result = dist.Normal.fit([1, 2, 3, 4, 5])
        assert(Math.abs(result.p.mu - 3) < 0.1)
      })

      it('Normal.fit should recover sigma close to MLE std dev', () => {
        const result = dist.Normal.fit([1, 2, 3, 4, 5])
        assert(Math.abs(result.p.sigma - Math.sqrt(2)) < 0.1)
      })

      it('Exponential.fit should return an Exponential instance', () => {
        const data = Array.from({ length: 20 }, (_, i) => (i + 1) * 0.1)
        const result = dist.Exponential.fit(data)
        assert(result instanceof dist.Exponential)
      })

      it('Pareto.fit should recover xmin close to min(data)', () => {
        const data = [1.5, 2.0, 3.1, 1.8, 2.5]
        const result = dist.Pareto.fit(data)
        assert(Math.abs(result.p.xmin - 1.5) < 1e-3)
      })

      it('Pareto.fit should recover alpha close to closed-form MLE', () => {
        const data = [1.5, 2.0, 3.1, 1.8, 2.5]
        const xmin = Math.min(...data)
        const alphaExpected = data.length / data.reduce((s, x) => s + Math.log(x / xmin), 0)
        const result = dist.Pareto.fit(data)
        assert(Math.abs(result.p.alpha - alphaExpected) < 0.05)
      })

      it('Bernoulli.fit should recover p close to planted value', () => {
        const data = new dist.Bernoulli(0.7).seed(42).sample(1000)
        const result = dist.Bernoulli.fit(data)
        assert(result instanceof dist.Bernoulli)
        assert(Math.abs(result.pdf(1) - 0.7) < 0.1)
      })

      it('Poisson.fit should recover lambda close to planted value', () => {
        const data = new dist.Poisson(3).seed(42).sample(1000)
        const result = dist.Poisson.fit(data)
        assert(result instanceof dist.Poisson)
        assert(Math.abs(result.p.lambda - 3) < 0.1)
      })

      it('Geometric.fit should recover p close to planted value', () => {
        const data = new dist.Geometric(0.4).seed(42).sample(1000)
        const result = dist.Geometric.fit(data)
        assert(result instanceof dist.Geometric)
        assert(Math.abs(result.p.p - 0.4) < 0.05)
      })

      it('DiscreteUniform.fit should recover xmin and xmax', () => {
        const data = new dist.DiscreteUniform(2, 8).seed(42).sample(1000)
        const result = dist.DiscreteUniform.fit(data)
        assert(result instanceof dist.DiscreteUniform)
        assert(result.p.xmin === 2)
        assert(result.p.xmax === 8)
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
  })

  // Ordinary distributions.
  testCases
    // .filter(tc => ['Rice'].indexOf(tc.name) > -1)
    .forEach(tc => {
      describe(tc.name, () => {
        describe('constructor', () => UnitTests.constructor(tc))
        describe('.seed()', () => UnitTests.seed(tc))
        describe('.load(), .save()', () => UnitTests.loadAndSave(tc))
        describe('.pdf(), .cdf(), .q()', () => UnitTests.analytical(tc))
        describe('.sample()', () => UnitTests.sample(tc))
        describe('.test()', () => UnitTests.test(tc))
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
})
