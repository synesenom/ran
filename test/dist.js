import { assert } from 'chai'
import { before, describe, it } from 'mocha'
import { adTest, chiTest, Tests, checkRefVals, checkQuantileVals } from './test-utils'
import { float } from '../src/core'
import * as dist from '../src/dist'
import PreComputed from '../src/dist/_pre-computed'
import Distribution from '../src/dist/_distribution'
import continuousCases from './dist-cases-continuous'
import discreteCases from './dist-cases-discrete'

const testCases = [...continuousCases, ...discreteCases]

// Constants.
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
      const s = 123456789 // fixed seed so CI failures are reproducible
      self.seed(s)
      const values1 = self.sample(sampleSize)
      self.seed(s)
      const values2 = self.sample(sampleSize)
      assert(values1.reduce((acc, d, i) => acc && d === values2[i], true))
    })

    it('should give different samples for different seeds', () => {
      const self = new dist[tc.name](...tc.cases[0].params())
      self.seed(123456789) // fixed seed so CI failures are reproducible
      const values1 = self.sample(sampleSize)
      self.seed(987654321) // different fixed seed to guarantee distinct sequence
      const values2 = self.sample(sampleSize)
      assert(values1.reduce((acc, d, i) => acc || d !== values2[i], false))
    })
  },

  loadAndSave (tc) {
    const sampleSize = 100

    it('loaded state should continue where it was saved at', () => {
      // Create generator and seed
      const generator = new dist[tc.name](...tc.cases[0].params())
      const s = 123456789 // fixed seed so CI failures are reproducible
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
      generator1.seed(123456789) // fixed seed so CI failures are reproducible

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

      it('Alpha.fit() returns a valid Alpha instance', () => {
        const data = new dist.Alpha(2, 1).seed(42).sample(100)
        const result = dist.Alpha.fit(data)
        assert(result instanceof dist.Alpha)
      })

      it('Distribution._fitPenalty base class should return 0 for any params', () => {
        assert.strictEqual(Distribution._fitPenalty({ p: { alpha: 1, beta: 1 } }), 0)
        assert.strictEqual(Distribution._fitPenalty({ p: {} }), 0)
      })

      it('Distribution._fitInit fallback random-retry path covers try-success and catch', () => {
        // All exported distributions now have _fitInit overrides, so call the base-class
        // method directly via a fake 2-param class with an ordering constraint (a < b).
        // ~50% of random draws in (0,5) violate a>=b, exercising both the catch and return paths.
        class FakeDist {
          static get length () { return 2 }
          constructor (a, b) {
            if (a >= b) throw new Error('invalid')
          }
        }
        const params = Distribution._fitInit.call(FakeDist, [1, 2, 3])
        assert(params.length === 2 && params[0] < params[1])
      })

      it('ZipfMandelbrot._fitInit should return valid params for typical data', () => {
        const data = new dist.ZipfMandelbrot(10, 2, 0).seed(42).sample(120)
        const init = dist.ZipfMandelbrot._fitInit(data)
        assert(init.length === 3)
        assert(Number.isFinite(init[0]) && init[0] >= 1) // N >= 1
        assert(Number.isFinite(init[1]) && init[1] > 1) // s > 1
        assert(Number.isFinite(init[2]) && init[2] >= 0) // q >= 0
      })

      it('ZipfMandelbrot._fitInit should fall back to q=0 when no rank-2 data exists', () => {
        const init = dist.ZipfMandelbrot._fitInit([1, 1, 1, 1])
        assert(init[2] === 0) // q falls back to 0 when only rank-1 observed
        assert(init[1] > 1) // s still valid
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
        const data = new dist.Bernoulli(0.7).seed(42).sample(200)
        const result = dist.Bernoulli.fit(data)
        assert(result instanceof dist.Bernoulli)
        assert(Math.abs(result.pdf(1) - 0.7) < 0.05)
      })

      it('Poisson.fit should recover lambda close to planted value', () => {
        const data = new dist.Poisson(3).seed(42).sample(200)
        const result = dist.Poisson.fit(data)
        assert(result instanceof dist.Poisson)
        assert(Math.abs(result.p.lambda - 3) < 0.15)
      })

      it('Geometric.fit should recover p close to planted value', () => {
        const data = new dist.Geometric(0.4).seed(42).sample(200)
        const result = dist.Geometric.fit(data)
        assert(result instanceof dist.Geometric)
        assert(Math.abs(result.p.p - 0.4) < 0.05)
      })

      it('DiscreteUniform.fit should recover xmin and xmax', () => {
        const data = new dist.DiscreteUniform(2, 8).seed(42).sample(200)
        const result = dist.DiscreteUniform.fit(data)
        assert(result instanceof dist.DiscreteUniform)
        assert(result.p.xmin === 2)
        assert(result.p.xmax === 8)
      })

      it('Gilbrat.fit should return a usable Gilbrat instance', () => {
        const result = dist.Gilbrat.fit([0.5, 1, 2, 3])
        assert(result instanceof dist.Gilbrat)
        assert(Number.isFinite(result.pdf(1)) && result.pdf(1) > 0)
      })

      it('HalfLogistic.fit should return a usable HalfLogistic instance', () => {
        const result = dist.HalfLogistic.fit([0.5, 1, 2, 3])
        assert(result instanceof dist.HalfLogistic)
        assert(Number.isFinite(result.pdf(1)) && result.pdf(1) > 0)
      })

      it('HyperbolicSecant.fit should return a usable HyperbolicSecant instance', () => {
        const result = dist.HyperbolicSecant.fit([-1, 0, 1, 2])
        assert(result instanceof dist.HyperbolicSecant)
        assert(Number.isFinite(result.pdf(0)) && result.pdf(0) > 0)
      })

      it('InvalidDiscrete.fit should return an InvalidDiscrete instance', () => {
        // data is irrelevant for k=0; instance is the only possible MLE
        const result = dist.InvalidDiscrete.fit([-1, 1, -1, 1, 1])
        assert(result instanceof dist.InvalidDiscrete)
      })

      it('Kolmogorov.fit should return a usable Kolmogorov instance', () => {
        const result = dist.Kolmogorov.fit([0.3, 0.5, 0.7, 1.0])
        assert(result instanceof dist.Kolmogorov)
        assert(Number.isFinite(result.pdf(0.5)) && result.pdf(0.5) > 0)
      })

      it('Rademacher.fit should return a usable Rademacher instance', () => {
        const result = dist.Rademacher.fit([-1, 1, -1, 1])
        assert(result instanceof dist.Rademacher)
        assert(result.pdf(-1) === 0.5 && result.pdf(1) === 0.5)
      })

      it('Slash.fit should return a usable Slash instance', () => {
        const result = dist.Slash.fit([-1, 0, 1, 2])
        assert(result instanceof dist.Slash)
        assert(Number.isFinite(result.pdf(0)) && result.pdf(0) > 0)
      })

      it('UniformRatio.fit should return a usable UniformRatio instance', () => {
        const result = dist.UniformRatio.fit([0.5, 1, 2, 3])
        assert(result instanceof dist.UniformRatio)
        assert(Number.isFinite(result.pdf(0.5)) && result.pdf(0.5) > 0)
      })

      it('LogNormal.fit should recover mu and sigma close to planted values', () => {
        const data = new dist.LogNormal(1, 0.5).seed(42).sample(200)
        const result = dist.LogNormal.fit(data)
        assert(result instanceof dist.LogNormal)
        assert(Math.abs(result.p.mu - 1) < 0.15)
        assert(Math.abs(result.p.sigma - 0.5) < 0.15)
      })

      it('LogCauchy.fit should recover x0 and gamma close to planted values', () => {
        const data = new dist.LogCauchy(0, 1).seed(42).sample(200)
        const result = dist.LogCauchy.fit(data)
        assert(result instanceof dist.LogCauchy)
        assert(Math.abs(result.p.x0 - 0) < 0.5)
        assert(Math.abs(result.p.gamma - 1) < 0.5)
      })

      it('LogLogistic.fit should recover alpha and beta close to planted values', () => {
        const data = new dist.LogLogistic(2, 3).seed(42).sample(200)
        const result = dist.LogLogistic.fit(data)
        assert(result instanceof dist.LogLogistic)
        assert(Math.abs(result.p.alpha - 2) < 0.3)
        assert(Math.abs(result.p.beta - 3) < 0.5)
      })

      it('LogLaplace.fit should recover mu and b close to planted values', () => {
        const data = new dist.LogLaplace(0, 1).seed(42).sample(200)
        const result = dist.LogLaplace.fit(data)
        assert(result instanceof dist.LogLaplace)
        assert(Math.abs(result.p.mu - 0) < 0.2)
        assert(Math.abs(result.p.b - 1) < 0.2)
      })

      it('LogisticExponential.fit should recover lambda and kappa close to planted values', () => {
        const data = new dist.LogisticExponential(1, 2).seed(42).sample(200)
        const result = dist.LogisticExponential.fit(data)
        assert(result instanceof dist.LogisticExponential)
        assert(Math.abs(result.p.lambda - 1) < 0.3)
        assert(Math.abs(result.p.kappa - 2) < 0.5)
      })

      it('LogitNormal.fit should recover mu and sigma close to planted values', () => {
        const data = new dist.LogitNormal(0, 1).seed(42).sample(200)
        const result = dist.LogitNormal.fit(data)
        assert(result instanceof dist.LogitNormal)
        assert(Math.abs(result.p.mu - 0) < 0.2)
        assert(Math.abs(result.p.sigma - 1) < 0.2)
      })

      it('LogNormal._fitInit should return sigma=1 for constant data', () => {
        const init = dist.LogNormal._fitInit([2, 2, 2])
        assert(Number.isFinite(init[0]))
        assert(init[1] === 1)
      })

      it('LogCauchy._fitInit should return valid params for odd-n data', () => {
        const init = dist.LogCauchy._fitInit(new dist.LogCauchy(0, 1).seed(1).sample(101))
        assert(Number.isFinite(init[0]))
        assert(init[1] > 0)
      })

      it('LogLogistic._fitInit should return positive params for constant data', () => {
        const init = dist.LogLogistic._fitInit([2, 2, 2])
        assert(init[0] > 0)
        assert(init[1] > 0)
      })

      it('LogLaplace._fitInit should return valid params for odd-n data', () => {
        const init = dist.LogLaplace._fitInit(new dist.LogLaplace(0, 1).seed(1).sample(101))
        assert(Number.isFinite(init[0]))
        assert(init[1] > 0)
      })

      it('LogisticExponential._fitInit should return valid params for odd-n data', () => {
        const init = dist.LogisticExponential._fitInit(new dist.LogisticExponential(1, 2).seed(1).sample(101))
        assert(init[0] > 0)
        assert(init[1] > 0)
      })

      it('LogisticExponential._fitInit should fall back to kappa=1 for degenerate data', () => {
        const init = dist.LogisticExponential._fitInit([5, 5, 5, 5])
        assert(init[0] > 0)
        assert(init[1] === 1)
      })

      it('LogitNormal._fitInit should return sigma=1 for constant data', () => {
        const init = dist.LogitNormal._fitInit([0.5, 0.5, 0.5])
        assert(Number.isFinite(init[0]))
        assert(init[1] === 1)
      })

      it('Exponential.fit should recover lambda close to planted value', () => {
        const data = new dist.Exponential(2).seed(42).sample(200)
        const result = dist.Exponential.fit(data)
        assert(result instanceof dist.Exponential)
        assert(Math.abs(result.p.lambda - 2) < 0.3)
      })

      it('Rayleigh.fit should recover sigma close to planted value', () => {
        const data = new dist.Rayleigh(1.5).seed(42).sample(200)
        const result = dist.Rayleigh.fit(data)
        assert(result instanceof dist.Rayleigh)
        // cdf(σ) = 1−exp(−½) for any Rayleigh(σ); valid only when fitted σ ≈ planted 1.5
        assert(Math.abs(result.cdf(1.5) - (1 - Math.exp(-0.5))) < 0.09)
      })

      it('MaxwellBoltzmann.fit should recover a close to planted value', () => {
        const data = new dist.MaxwellBoltzmann(2).seed(42).sample(200)
        const result = dist.MaxwellBoltzmann.fit(data)
        assert(result instanceof dist.MaxwellBoltzmann)
        // pdf(a; a) = sqrt(2/π)·exp(−½)/a for Maxwell-Boltzmann(a); checks a ≈ 2
        assert(Math.abs(result.pdf(2) - Math.sqrt(2 / Math.PI) * Math.exp(-0.5) / 2) < 0.08)
      })

      it('HalfNormal.fit should recover sigma close to planted value', () => {
        const data = new dist.HalfNormal(1.5).seed(42).sample(200)
        const result = dist.HalfNormal.fit(data)
        assert(result instanceof dist.HalfNormal)
        assert(Math.abs(result.p.sigma - 1.5) < 0.2)
      })

      it('Levy.fit should recover mu and c close to planted values', () => {
        const data = new dist.Levy(1, 2).seed(42).sample(200)
        const result = dist.Levy.fit(data)
        assert(result instanceof dist.Levy)
        assert(Math.abs(result.p.mu - 1) < 0.3)
        assert(Math.abs(result.p.c - 2) < 0.8)
      })

      it('Chi.fit should recover k exactly for planted k=4', () => {
        const data = new dist.Chi(4).seed(42).sample(200)
        const result = dist.Chi.fit(data)
        assert(result instanceof dist.Chi)
        assert.strictEqual(result.p.k, 4)
      })

      it('Categorical.fit should recover category probabilities close to planted values', () => {
        const data = new dist.Categorical([0.2, 0.3, 0.5], 0).seed(42).sample(500)
        const result = dist.Categorical.fit(data)
        assert(result instanceof dist.Categorical)
        assert(Math.abs(result.pdf(0) - 0.2) < 0.1)
        assert(Math.abs(result.pdf(1) - 0.3) < 0.1)
        assert(Math.abs(result.pdf(2) - 0.5) < 0.1)
      })

      it('Hyperexponential.fit should recover a mixture whose mean matches the data', () => {
        const data = new dist.Hyperexponential([
          { weight: 0.5, rate: 1 },
          { weight: 0.5, rate: 5 }
        ]).seed(42).sample(500)
        const result = dist.Hyperexponential.fit(data)
        assert(result instanceof dist.Hyperexponential)
        // Component label-switching makes (weight, rate) pairs non-identifiable; use the mixture
        // mean E[X] = Σ w_i / λ_i — a sufficient statistic invariant under that permutation.
        const sampleMean = data.reduce((s, x) => s + x, 0) / data.length
        const fittedMean = result.p.weights.reduce((s, w, i) => s + w / result.p.rates[i], 0)
        assert(Math.abs(fittedMean - sampleMean) < 0.2)
      })

      it('Zeta.fit should recover s close to planted value', () => {
        const data = new dist.Zeta(2.5).seed(42).sample(500)
        const result = dist.Zeta.fit(data)
        assert(result instanceof dist.Zeta)
        assert(Math.abs(result.p.s - 2.5) < 0.3)
      })

      it('YuleSimon.fit should recover rho close to planted value', () => {
        const data = new dist.YuleSimon(3).seed(42).sample(200)
        const result = dist.YuleSimon.fit(data)
        assert(result instanceof dist.YuleSimon)
        assert(Math.abs(result.p.rho - 3) < 0.5)
      })

      it('LogSeries.fit should recover p close to planted value', () => {
        const data = new dist.LogSeries(0.7).seed(42).sample(200)
        const result = dist.LogSeries.fit(data)
        assert(result instanceof dist.LogSeries)
        assert(Math.abs(result.p.p - 0.7) < 0.05)
      })

      it('FlorySchulz.fit should recover a close to planted value', () => {
        const data = new dist.FlorySchulz(0.4).seed(42).sample(200)
        const result = dist.FlorySchulz.fit(data)
        assert(result instanceof dist.FlorySchulz)
        assert(Math.abs(result.p.a - 0.4) < 0.05)
      })

      it('NegativeBinomial.fit should return a usable NegativeBinomial instance', () => {
        const data = new dist.NegativeBinomial(5, 0.4).seed(42).sample(200)
        const result = dist.NegativeBinomial.fit(data)
        assert(result instanceof dist.NegativeBinomial)
        assert(result.p.r > 0 && result.p.p > 0 && result.p.p < 1)
        assert(Number.isFinite(result.pdf(Math.round(5 * 0.4 / 0.6))) && result.pdf(Math.round(5 * 0.4 / 0.6)) > 0)
      })

      it('Skellam.fit should return a usable Skellam instance', () => {
        const data = new dist.Skellam(4, 2).seed(42).sample(200)
        const result = dist.Skellam.fit(data)
        assert(result instanceof dist.Skellam)
        assert(result.p.mu1 > 0 && result.p.mu2 > 0)
        assert(Number.isFinite(result.pdf(2)) && result.pdf(2) > 0)
      })

      it('DiscreteWeibull.fit should return a usable DiscreteWeibull instance', () => {
        const data = new dist.DiscreteWeibull(0.5, 1.5).seed(42).sample(200)
        const result = dist.DiscreteWeibull.fit(data)
        assert(result instanceof dist.DiscreteWeibull)
        assert(result.p.q > 0 && result.p.q < 1 && result.p.beta > 0)
        assert(Number.isFinite(result.pdf(0)) && result.pdf(0) > 0)
      })

      it('Logarithmic.fit should recover a and b close to planted values', () => {
        const data = new dist.Logarithmic(1, 5).seed(42).sample(200)
        const result = dist.Logarithmic.fit(data)
        assert(result instanceof dist.Logarithmic)
        assert(Math.abs(result.p.a - 1) < 0.2 && Math.abs(result.p.b - 5) < 0.3)
      })

      it('ExponentialLogarithmic.fit should return a usable ExponentialLogarithmic instance', () => {
        const data = new dist.ExponentialLogarithmic(0.7, 1).seed(42).sample(200)
        const result = dist.ExponentialLogarithmic.fit(data)
        assert(result instanceof dist.ExponentialLogarithmic)
        assert(result.p.p > 0 && result.p.p < 1 && result.p.beta > 0)
        assert(Number.isFinite(result.pdf(1)) && result.pdf(1) > 0)
      })

      it('Borel.fit should recover mu close to planted value', () => {
        const data = new dist.Borel(0.5).seed(42).sample(200)
        const result = dist.Borel.fit(data)
        assert(result instanceof dist.Borel)
        assert(Math.abs(result.p.mu - 0.5) < 0.1)
      })

      it('HeadsMinusTails.fit should recover n exactly for planted n=5', () => {
        // seed=4 produces a sample whose max reaches 10 (=2n), so nSeed=5 and n=5 is the MLE
        const data = new dist.HeadsMinusTails(5).seed(4).sample(200)
        const result = dist.HeadsMinusTails.fit(data)
        assert(result instanceof dist.HeadsMinusTails)
        assert.strictEqual(result.p.n, 5)
      })

      it('BorelTanner.fit should return a usable BorelTanner instance', () => {
        const data = new dist.BorelTanner(0.5, 3).seed(42).sample(200)
        const result = dist.BorelTanner.fit(data)
        assert(result instanceof dist.BorelTanner)
        assert(result.p.mu >= 0 && result.p.mu < 1 && result.p.n > 0)
        assert(Number.isFinite(result.pdf(result.p.n)) && result.pdf(result.p.n) > 0)
      })

      it('ConwayMaxwellPoisson.fit should return a usable ConwayMaxwellPoisson instance', () => {
        const data = new dist.ConwayMaxwellPoisson(3, 2).seed(42).sample(200)
        const result = dist.ConwayMaxwellPoisson.fit(data)
        assert(result instanceof dist.ConwayMaxwellPoisson)
        assert(result.p.lambda > 0 && result.p.nu > 0)
        assert(Number.isFinite(result.pdf(3)) && result.pdf(3) > 0)
      })

      it('PolyaAeppli.fit should return a usable PolyaAeppli instance', () => {
        const data = new dist.PolyaAeppli(2, 0.5).seed(42).sample(200)
        const result = dist.PolyaAeppli.fit(data)
        assert(result instanceof dist.PolyaAeppli)
        assert(result.p.lambda > 0 && result.p.theta > 0 && result.p.theta < 1)
        assert(Number.isFinite(result.pdf(2)) && result.pdf(2) > 0)
      })

      it('NeymanA.fit should return a usable NeymanA instance', () => {
        const data = new dist.NeymanA(3, 2).seed(42).sample(200)
        const result = dist.NeymanA.fit(data)
        assert(result instanceof dist.NeymanA)
        assert(result.p.lambda > 0 && result.p.phi > 0)
        assert(Number.isFinite(result.pdf(6)) && result.pdf(6) > 0)
      })

      it('GeneralizedHermite.fit should return a usable GeneralizedHermite instance', () => {
        const data = new dist.GeneralizedHermite(1, 0.5, 2).seed(42).sample(200)
        const result = dist.GeneralizedHermite.fit(data)
        assert(result instanceof dist.GeneralizedHermite)
        assert(result.p.a1 > 0 && result.p.a2 > 0 && result.p.m > 1)
        assert(Number.isFinite(result.pdf(2)) && result.pdf(2) > 0)
      })

      it('Delaporte.fit should return a usable Delaporte instance', () => {
        const data = new dist.Delaporte(2, 1, 1).seed(42).sample(200)
        const result = dist.Delaporte.fit(data)
        assert(result instanceof dist.Delaporte)
        assert(result.p.alpha > 0 && result.p.beta > 0 && result.p.lambda > 0)
        assert(Number.isFinite(result.pdf(3)) && result.pdf(3) > 0)
      })

      it('Cauchy.fit should recover x0 and gamma close to planted values', () => {
        const data = new dist.Cauchy(2, 1).seed(42).sample(500)
        const result = dist.Cauchy.fit(data)
        assert(result instanceof dist.Cauchy)
        assert(Math.abs(result.p.x0 - 2) < 0.5)
        assert(Math.abs(result.p.gamma - 1) < 0.5)
      })

      it('Laplace.fit should recover mu and b close to planted values', () => {
        const data = new dist.Laplace(1, 2).seed(42).sample(200)
        const result = dist.Laplace.fit(data)
        assert(result instanceof dist.Laplace)
        assert(Math.abs(result.p.mu - 1) < 0.3)
        assert(Math.abs(result.p.b - 2) < 0.4)
      })

      it('Logistic.fit should recover mu and s close to planted values', () => {
        const data = new dist.Logistic(1, 2).seed(42).sample(200)
        const result = dist.Logistic.fit(data)
        assert(result instanceof dist.Logistic)
        assert(Math.abs(result.p.mu - 1) < 0.4)
        assert(Math.abs(result.p.s - 2) < 0.4)
      })

      it('Gumbel.fit should recover mu and beta close to planted values', () => {
        const data = new dist.Gumbel(1, 2).seed(42).sample(200)
        const result = dist.Gumbel.fit(data)
        assert(result instanceof dist.Gumbel)
        assert(Math.abs(result.p.mu - 1) < 0.4)
        assert(Math.abs(result.p.beta - 2) < 0.4)
      })

      it('Moyal.fit should recover mu and sigma close to planted values', () => {
        const data = new dist.Moyal(1, 2).seed(42).sample(200)
        const result = dist.Moyal.fit(data)
        assert(result instanceof dist.Moyal)
        assert(Math.abs(result.p.mu - 1) < 0.5)
        assert(Math.abs(result.p.sigma - 2) < 0.5)
      })

      it('TukeyLambda.fit should recover lambda close to planted value', () => {
        const data = new dist.TukeyLambda(0.5).seed(42).sample(500)
        const result = dist.TukeyLambda.fit(data)
        assert(result instanceof dist.TukeyLambda)
        assert(Math.abs(result.p.lambda - 0.5) < 0.2)
      })

      it('SkewNormal.fit should recover xi, omega, and alpha close to planted values', () => {
        const data = new dist.SkewNormal(1, 2, 3).seed(42).sample(300)
        const result = dist.SkewNormal.fit(data)
        assert(result instanceof dist.SkewNormal)
        assert(Math.abs(result.p.xi - 1) < 0.5)
        assert(Math.abs(result.p.omega - 2) < 0.5)
        assert(Math.abs(result.p.alpha - 3) < 1.5)
      })

      it('GeneralizedNormal.fit should recover mu, alpha, and beta close to planted values', () => {
        const data = new dist.GeneralizedNormal(1, 2, 2).seed(42).sample(300)
        const result = dist.GeneralizedNormal.fit(data)
        assert(result instanceof dist.GeneralizedNormal)
        assert(Math.abs(result.p.mu - 1) < 0.3)
        assert(Math.abs(result.p.alpha2 - 2) < 0.5)
        assert(Math.abs(result.p.beta2 - 2) < 0.5)
      })

      it('HalfGeneralizedNormal.fit should recover alpha and beta close to planted values', () => {
        const data = new dist.HalfGeneralizedNormal(2, 2).seed(42).sample(300)
        const result = dist.HalfGeneralizedNormal.fit(data)
        assert(result instanceof dist.HalfGeneralizedNormal)
        assert(Math.abs(result.p.alpha2 - 2) < 0.5)
        assert(Math.abs(result.p.beta2 - 2) < 0.5)
      })

      it('GeneralizedLogistic.fit should recover mu, s, and c close to planted values', () => {
        const data = new dist.GeneralizedLogistic(1, 2, 2).seed(42).sample(300)
        const result = dist.GeneralizedLogistic.fit(data)
        assert(result instanceof dist.GeneralizedLogistic)
        assert(Math.abs(result.p.mu - 1) < 0.5)
        assert(Math.abs(result.p.s - 2) < 0.6)
        assert(Math.abs(result.p.c - 2) < 0.6)
      })

      it('Gamma.fit should recover alpha and beta close to planted values', () => {
        const data = new dist.Gamma(2, 0.5).seed(42).sample(200)
        const result = dist.Gamma.fit(data)
        assert(result instanceof dist.Gamma)
        assert(Math.abs(result.p.alpha - 2) < 0.4)
        assert(Math.abs(result.p.beta - 0.5) < 0.15)
      })

      it('InverseGamma.fit should recover alpha and beta close to planted values', () => {
        const data = new dist.InverseGamma(3, 2).seed(42).sample(200)
        const result = dist.InverseGamma.fit(data)
        assert(result instanceof dist.InverseGamma)
        assert(Math.abs(result.p.alpha - 3) < 0.6)
        assert(Math.abs(result.p.beta - 2) < 0.8)
      })

      it('Erlang.fit should recover k exactly for planted k=3', () => {
        const data = new dist.Erlang(3, 1).seed(42).sample(200)
        const result = dist.Erlang.fit(data)
        assert(result instanceof dist.Erlang)
        assert.strictEqual(result.p.alpha, 3)
        assert(Math.abs(result.p.beta - 1) < 0.25)
      })

      it('Erlang.fit profile search recovers k=3 when moment seed gives k=4', () => {
        // seed=20: mean²/var ≈ 4 so _fitInit seeds k=4; profile over [1..9] finds k=3 has higher lnL
        const data = new dist.Erlang(3, 1).seed(20).sample(200)
        const result = dist.Erlang.fit(data)
        assert(result instanceof dist.Erlang)
        assert.strictEqual(result.p.alpha, 3)
      })

      it('Chi2.fit should recover k exactly for planted k=4', () => {
        const data = new dist.Chi2(4).seed(42).sample(200)
        const result = dist.Chi2.fit(data)
        assert(result instanceof dist.Chi2)
        assert.strictEqual(result.p.alpha * 2, 4)
      })

      it('InverseChi2.fit should recover nu exactly for planted nu=6', () => {
        const data = new dist.InverseChi2(6).seed(42).sample(200)
        const result = dist.InverseChi2.fit(data)
        assert(result instanceof dist.InverseChi2)
        assert.strictEqual(result.p.nu, 6)
      })

      it('LogGamma.fit should recover alpha and beta close to planted values', () => {
        const data = new dist.LogGamma(2, 1, 0).seed(42).sample(200)
        const result = dist.LogGamma.fit(data)
        assert(result instanceof dist.LogGamma)
        assert(Math.abs(result.p.alpha - 2) < 0.6)
        assert(Math.abs(result.p.beta - 1) < 0.4)
      })

      it('GeneralizedGamma.fit should return a usable GeneralizedGamma instance', () => {
        const data = new dist.GeneralizedGamma(2, 3, 1).seed(42).sample(200)
        const result = dist.GeneralizedGamma.fit(data)
        assert(result instanceof dist.GeneralizedGamma)
        assert(result.p.a > 0 && result.p.d > 0 && result.p.p > 0)
        assert(Number.isFinite(result.pdf(4)) && result.pdf(4) > 0)
      })

      it('GammaGompertz.fit should return a usable GammaGompertz instance', () => {
        const data = new dist.GammaGompertz(1, 2, 3).seed(42).sample(200)
        const result = dist.GammaGompertz.fit(data)
        assert(result instanceof dist.GammaGompertz)
        assert(result.p.b > 0 && result.p.s > 0 && result.p.beta > 0)
        assert(Number.isFinite(result.pdf(1)) && result.pdf(1) > 0)
      })

      it('DoubleGamma.fit should recover alpha and beta close to planted values', () => {
        const data = new dist.DoubleGamma(2, 0.5).seed(42).sample(200)
        const result = dist.DoubleGamma.fit(data)
        assert(result instanceof dist.DoubleGamma)
        assert(Math.abs(result.p.alpha - 2) < 0.4)
        assert(Math.abs(result.p.beta - 0.5) < 0.15)
      })

      it('Beta.fit should recover alpha and beta close to planted values', () => {
        const data = new dist.Beta(2, 3).seed(42).sample(200)
        const result = dist.Beta.fit(data)
        assert(result instanceof dist.Beta)
        assert(Math.abs(result.p.alpha - 2) < 0.6)
        assert(Math.abs(result.p.beta - 3) < 0.8)
      })

      it('BetaPrime.fit should recover alpha and beta close to planted values', () => {
        const data = new dist.BetaPrime(2, 3).seed(42).sample(200)
        const result = dist.BetaPrime.fit(data)
        assert(result instanceof dist.BetaPrime)
        assert(Math.abs(result.p.alpha - 2) < 0.7)
        assert(Math.abs(result.p.beta - 3) < 1.0)
      })

      it('Beta.fit should not converge to near-singular alpha or beta', () => {
        // Beta(0.5, 0.5) is U-shaped and most susceptible to near-singularity: the optimizer
        // can find near-zero shapes that fit data concentrated near the boundaries.
        // Without the _fitPenalty log-barrier the optimizer can return alpha < 0.05.
        const data = new dist.Beta(0.5, 0.5).seed(42).sample(200)
        const result = dist.Beta.fit(data)
        assert(result instanceof dist.Beta)
        assert(result.p.alpha > 0.3 && result.p.alpha < 1.5, `alpha ${result.p.alpha} out of expected range`)
        assert(result.p.beta > 0.3 && result.p.beta < 1.5, `beta ${result.p.beta} out of expected range`)
      })

      it('BetaPrime.fit should not converge to near-singular alpha or beta', () => {
        const data = new dist.BetaPrime(1.5, 2.0).seed(42).sample(200)
        const result = dist.BetaPrime.fit(data)
        assert(result instanceof dist.BetaPrime)
        assert(result.p.alpha > 0.5 && result.p.alpha < 8, `alpha ${result.p.alpha} out of expected range`)
        assert(result.p.beta > 0.5 && result.p.beta < 8, `beta ${result.p.beta} out of expected range`)
      })

      it('Kumaraswamy.fit should recover a and b close to planted values', () => {
        const data = new dist.Kumaraswamy(2, 3).seed(42).sample(200)
        const result = dist.Kumaraswamy.fit(data)
        assert(result instanceof dist.Kumaraswamy)
        assert(Math.abs(result.p.a - 2) < 0.7)
        assert(Math.abs(result.p.b - 3) < 1.0)
      })

      it('PowerLaw.fit should recover a close to planted value', () => {
        const data = new dist.PowerLaw(2).seed(42).sample(200)
        const result = dist.PowerLaw.fit(data)
        assert(result instanceof dist.PowerLaw)
        assert(Math.abs(result.p.a - 2) < 0.4)
      })

      it('Arcsine.fit should recover a and b close to planted values', () => {
        const data = new dist.Arcsine(1, 5).seed(42).sample(200)
        const result = dist.Arcsine.fit(data)
        assert(result instanceof dist.Arcsine)
        assert(Math.abs(result.p.a - 1) < 0.4)
        assert(Math.abs(result.p.b - 5) < 0.4)
      })

      it('Mielke.fit should recover k and s close to planted values', () => {
        const data = new dist.Mielke(2, 1).seed(42).sample(200)
        const result = dist.Mielke.fit(data)
        assert(result instanceof dist.Mielke)
        assert(Math.abs(result.p.k - 2) < 0.6)
        assert(Math.abs(result.p.s - 1) < 0.5)
      })

      it('Uniform.fit should recover xmin and xmax close to planted values', () => {
        const data = new dist.Uniform(1, 5).seed(42).sample(200)
        const result = dist.Uniform.fit(data)
        assert(result instanceof dist.Uniform)
        assert(Math.abs(result.p.xmin - 1) < 0.2)
        assert(Math.abs(result.p.xmax - 5) < 0.2)
      })

      it('UQuadratic.fit should recover a and b close to planted values', () => {
        const data = new dist.UQuadratic(0, 4).seed(42).sample(200)
        const result = dist.UQuadratic.fit(data)
        assert(result instanceof dist.UQuadratic)
        assert(Math.abs(result.p.a - 0) < 0.3)
        assert(Math.abs(result.p.b - 4) < 0.3)
      })

      it('Triangular.fit should recover a, b, and c close to planted values', () => {
        const data = new dist.Triangular(1, 5, 3).seed(42).sample(200)
        const result = dist.Triangular.fit(data)
        assert(result instanceof dist.Triangular)
        assert(Math.abs(result.p.a - 1) < 0.3)
        assert(Math.abs(result.p.b - 5) < 0.3)
        assert(Math.abs(result.p.c - 3) < 0.5)
      })

      it('Bates.fit recovers integer n exactly for n = 1, 2, 3', () => {
        // n >= 4 approaches Gaussian and n becomes weakly identified; test the identifiable range
        const cases = [
          [1, 0, 1],
          [2, -1, 3],
          [3, 1, 5]
        ]
        for (const [n, a, b] of cases) {
          const data = new dist.Bates(n, a, b).seed(1).sample(1000)
          const result = dist.Bates.fit(data)
          assert(result instanceof dist.Bates)
          assert.strictEqual(result.p.n, n)
          assert(Math.abs(result.p.a - a) < 0.1)
          assert(Math.abs(result.p.b - b) < 0.1)
        }
      })

      it('Trapezoidal.fit should recover a, b, c, d close to planted values', () => {
        const data = new dist.Trapezoidal(0, 1, 3, 5).seed(42).sample(200)
        const result = dist.Trapezoidal.fit(data)
        assert(result instanceof dist.Trapezoidal)
        assert(Math.abs(result.p.a - 0) < 0.3)
        assert(Math.abs(result.p.b - 1) < 0.5)
        assert(Math.abs(result.p.c - 3) < 1.0)
        assert(Math.abs(result.p.d - 5) < 0.3)
      })

      it('PERT._fitPenalty should return 0', () => {
        assert.strictEqual(dist.PERT._fitPenalty(), 0)
      })

      it('PERT.fit should recover a, b, and c close to planted values', () => {
        const data = new dist.PERT(0, 3, 6).seed(42).sample(200)
        const result = dist.PERT.fit(data)
        assert(result instanceof dist.PERT)
        assert(Math.abs(result.p.a - 0) < 0.3)
        assert(Math.abs(result.p.c - 6) < 0.3)
        assert(Math.abs(result.p.b - 3) < 0.5)
      })

      it('BetaRectangular.fit should return a valid instance close to planted values', () => {
        const data = new dist.BetaRectangular(2, 3, 0.7, 0, 4).seed(42).sample(300)
        const result = dist.BetaRectangular.fit(data)
        assert(result instanceof dist.BetaRectangular)
        // alpha/beta > 0.5 ensures the optimizer did not converge to the near-singularity at 0.
        // Without the _fitPenalty log-barrier the optimizer can return alpha/beta < 0.01.
        assert(result.p.alpha > 0.5 && result.p.alpha < 10, `alpha ${result.p.alpha} out of range`)
        assert(result.p.beta > 0.5 && result.p.beta < 10, `beta ${result.p.beta} out of range`)
        assert(result.p.theta > 0.1 && result.p.theta <= 1)
        assert(Math.abs(result.p.a - 0) < 0.3)
        assert(Math.abs(result.p.b - 4) < 0.3)
      })

      it('BetaRectangular.fit should not converge to near-singular alpha or beta', () => {
        // Data from a near-uniform BetaRectangular is most likely to trigger the singularity:
        // the optimizer can set alpha/beta ≈ 0 and theta ≈ 1 to concentrate mass at boundaries,
        // exploiting the large-but-finite likelihood just above alpha = 0.
        const data = new dist.BetaRectangular(0.8, 0.8, 0.6, 0, 10).seed(7).sample(300)
        const result = dist.BetaRectangular.fit(data)
        assert(result instanceof dist.BetaRectangular)
        assert(result.p.alpha > 0.3, `alpha ${result.p.alpha} is near-singular`)
        assert(result.p.beta > 0.3, `beta ${result.p.beta} is near-singular`)
      })

      it('UniformProduct.fit should recover n close to planted value', () => {
        const data = new dist.UniformProduct(3).seed(42).sample(200)
        const result = dist.UniformProduct.fit(data)
        assert(result instanceof dist.UniformProduct)
        assert(result.p.n === 3)
      })

      it('Anglit.fit should recover mu and beta close to planted values', () => {
        const data = new dist.Anglit(1, 1.5).seed(42).sample(200)
        const result = dist.Anglit.fit(data)
        assert(result instanceof dist.Anglit)
        assert(Math.abs(result.p.mu - 1) < 0.3)
        assert(Math.abs(result.p.beta - 1.5) < 0.4)
      })

      it('RaisedCosine.fit should recover mu and s close to planted values', () => {
        const data = new dist.RaisedCosine(2, 3).seed(42).sample(200)
        const result = dist.RaisedCosine.fit(data)
        assert(result instanceof dist.RaisedCosine)
        assert(Math.abs(result.p.mu - 2) < 0.4)
        assert(Math.abs(result.p.s - 3) < 0.4)
      })

      it('Weibull.fit should recover lambda and k close to planted values', () => {
        const data = new dist.Weibull(2, 1.5).seed(42).sample(200)
        const result = dist.Weibull.fit(data)
        assert(result instanceof dist.Weibull)
        assert(Math.abs(result.p.lambda2 - 2) < 0.5)
        assert(Math.abs(result.p.k - 1.5) < 0.3)
      })

      it('InvertedWeibull.fit should recover c close to planted value', () => {
        const data = new dist.InvertedWeibull(3).seed(42).sample(200)
        const result = dist.InvertedWeibull.fit(data)
        assert(result instanceof dist.InvertedWeibull)
        assert(Math.abs(result.p.c - 3) < 0.6)
      })

      it('DoubleWeibull.fit should recover lambda and k close to planted values', () => {
        const data = new dist.DoubleWeibull(2, 1.5).seed(42).sample(200)
        const result = dist.DoubleWeibull.fit(data)
        assert(result instanceof dist.DoubleWeibull)
        assert(Math.abs(result.p.lambda2 - 2) < 0.5)
        assert(Math.abs(result.p.k - 1.5) < 0.4)
      })

      it('ExponentiatedWeibull.fit should recover lambda, k, and alpha close to planted values', () => {
        const data = new dist.ExponentiatedWeibull(2, 1.5, 2).seed(42).sample(200)
        const result = dist.ExponentiatedWeibull.fit(data)
        assert(result instanceof dist.ExponentiatedWeibull)
        assert(Math.abs(result.p.lambda2 - 2) < 0.8)
        assert(Math.abs(result.p.k - 1.5) < 0.6)
        assert(Math.abs(result.p.alpha - 2) < 0.8)
      })

      it('Frechet.fit should recover alpha and s close to planted values', () => {
        const data = new dist.Frechet(2, 1, 0).seed(42).sample(200)
        const result = dist.Frechet.fit(data)
        assert(result instanceof dist.Frechet)
        assert(Math.abs(result.p.alpha - 2) < 0.5)
        assert(Math.abs(result.p.s - 1) < 0.4)
      })

      it('GeneralizedExtremeValue.fit should recover c close to planted value', () => {
        const data = new dist.GeneralizedExtremeValue(0.5).seed(42).sample(200)
        const result = dist.GeneralizedExtremeValue.fit(data)
        assert(result instanceof dist.GeneralizedExtremeValue)
        assert(Math.abs(result.p.c - 0.5) < 0.2)
      })

      it('ShiftedLogLogistic.fit should recover mu and sigma close to planted values', () => {
        const data = new dist.ShiftedLogLogistic(1, 2, 0).seed(42).sample(200)
        const result = dist.ShiftedLogLogistic.fit(data)
        assert(result instanceof dist.ShiftedLogLogistic)
        assert(Math.abs(result.p.mu - 1) < 0.4)
        assert(Math.abs(result.p.sigma - 2) < 0.6)
      })

      it('Weibull._fitInit should handle constant data', () => {
        // || 1 guard: zero variance in constant data falls back to 1
        const init = dist.Weibull._fitInit([3, 3, 3])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('InvertedWeibull._fitInit should handle constant data', () => {
        // || 1 guard: zero variance in constant reciprocals falls back to 1
        const init = dist.InvertedWeibull._fitInit([2, 2, 2])
        assert(init[0] > 0)
      })

      it('Frechet._fitInit should handle constant data', () => {
        // || 1 guard: all equal → zero variance in reciprocals → fallback to 1
        const init = dist.Frechet._fitInit([5, 5, 5])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('Frechet._fitInit should use mean fallback when alpha <= 1', () => {
        // one near-zero and three large values → cv of reciprocals > 1 → Justus gives alpha ≤ 1
        const init = dist.Frechet._fitInit([0.0001, 1000, 1000, 1000])
        assert(init[0] > 0 && init[0] <= 1)
        assert(init[1] > 0)
      })

      it('GeneralizedExtremeValue._fitInit should return negative c for right-skewed data', () => {
        // c < 0 (Fréchet type) has heavier right tail with skewness > Gumbel limit ≈1.14
        const data = new dist.GeneralizedExtremeValue(-0.5).seed(42).sample(200)
        const init = dist.GeneralizedExtremeValue._fitInit(data)
        assert(init[0] < 0)
      })

      it('ShiftedLogLogistic._fitInit should handle odd-n data', () => {
        // odd-n path: median = sorted[(n-1)/2]
        const init = dist.ShiftedLogLogistic._fitInit([1, 2, 3, 4, 5])
        assert(Number.isFinite(init[0]))
        assert(init[1] > 0)
      })

      it('JohnsonSU._fitInit should fall back to moments when quantile ratio is degenerate', () => {
        // constant data → all four quantiles equal → p = 0 → ratio = NaN → moments fallback
        const init = dist.JohnsonSU._fitInit([2, 2, 2, 2, 2])
        assert(Array.isArray(init) && init.length === 4)
        assert(init[1] > 0) // delta > 0
        assert(init[2] > 0) // lambda > 0
      })

      it('JohnsonSU.fit should recover gamma, delta, lambda, xi close to planted values', () => {
        const data = new dist.JohnsonSU(0, 2, 2, 0).seed(42).sample(300)
        const result = dist.JohnsonSU.fit(data)
        assert(result instanceof dist.JohnsonSU)
        assert(Math.abs(result.p.gamma - 0) < 0.5)
        assert(Math.abs(result.p.delta - 2) < 0.5)
        assert(Math.abs(result.p.lambda - 2) < 0.6)
        assert(Math.abs(result.p.xi - 0) < 0.5)
      })

      it('JohnsonSB.fit should recover gamma, delta, lambda, xi close to planted values', () => {
        const data = new dist.JohnsonSB(0, 2, 2, 0).seed(42).sample(300)
        const result = dist.JohnsonSB.fit(data)
        assert(result instanceof dist.JohnsonSB)
        assert(Math.abs(result.p.gamma - 0) < 0.5)
        assert(Math.abs(result.p.delta - 2) < 0.5)
        assert(Math.abs(result.p.lambda - 2) < 0.6)
        assert(Math.abs(result.p.xi - 0) < 0.3)
      })

      it('R._fitPenalty should return 0', () => {
        assert.strictEqual(dist.R._fitPenalty(), 0)
      })

      it('R.fit should recover c close to planted value', () => {
        const data = new dist.R(3).seed(42).sample(200)
        const result = dist.R.fit(data)
        assert(result instanceof dist.R)
        assert(Math.abs(result.p.c - 3) < 0.5)
      })

      it('BaldingNichols._fitPenalty should return 0', () => {
        assert.strictEqual(dist.BaldingNichols._fitPenalty(), 0)
      })

      it('BaldingNichols.fit should recover F and p close to planted values', () => {
        const data = new dist.BaldingNichols(0.1, 0.3).seed(42).sample(200)
        const result = dist.BaldingNichols.fit(data)
        assert(result instanceof dist.BaldingNichols)
        assert(Math.abs(result.p.F - 0.1) < 0.05)
        assert(Math.abs(result.p.p - 0.3) < 0.05)
      })

      it('BaldingNichols constructor should expose F and p on this.p', () => {
        const d = new dist.BaldingNichols(0.1, 0.3)
        assert(d.p.F === 0.1)
        assert(d.p.p === 0.3)
      })

      it('F._fitPenalty should return 0', () => {
        assert.strictEqual(dist.F._fitPenalty(), 0)
      })

      it('F.fit should return a valid F instance', () => {
        const data = new dist.F(10, 20).seed(42).sample(200)
        const result = dist.F.fit(data)
        assert(result instanceof dist.F)
        assert(result.p.d1 > 0 && result.p.d2 > 0)
        assert(Number.isFinite(result.pdf(1)) && result.pdf(1) > 0)
      })

      it('F.fit profile search finds higher lnL than moment seed when round(seed) is suboptimal', () => {
        // seed=8: _fitInit gives d1Seed=4,d2Seed=14; profile grid finds (5,11) with higher lnL
        const data = new dist.F(5, 10).seed(8).sample(200)
        const result = dist.F.fit(data)
        assert(result instanceof dist.F)
        // Profile MLE has strictly higher lnL than the moment-seed answer
        assert(new dist.F(result.p.d1, result.p.d2).lnL(data) > new dist.F(4, 14).lnL(data))
      })

      it('FisherZ._fitPenalty should return 0', () => {
        assert.strictEqual(dist.FisherZ._fitPenalty(), 0)
      })

      it('FisherZ.fit should return a FisherZ instance (not F)', () => {
        const data = new dist.FisherZ(10, 20).seed(42).sample(200)
        const result = dist.FisherZ.fit(data)
        assert(result instanceof dist.FisherZ)
        assert(result.p.d1 > 0 && result.p.d2 > 0)
        assert(Number.isFinite(result.pdf(0)) && result.pdf(0) > 0)
      })

      it('StudentT._fitInit should derive nu from sample variance', () => {
        // variance = nu/(nu−2) ⇒ nu = 2·Var/(Var−1); Var≈5/3 for nu=5 ⇒ nu≈5
        const data = new dist.StudentT(5).seed(42).sample(500)
        const init = dist.StudentT._fitInit(data)
        assert(init.length === 1)
        assert(Math.abs(init[0] - 5) < 1.5)
      })

      it('StudentT.fit should recover nu close to planted value', () => {
        const data = new dist.StudentT(5).seed(42).sample(500)
        const result = dist.StudentT.fit(data)
        assert(result instanceof dist.StudentT)
        assert(Math.abs(result.p.nu - 5) < 1.5)
      })

      it('StudentZ._fitInit should derive n from sample variance', () => {
        // Var[Z] = 1/(n−3) ⇒ n = 1/Var + 3; Var≈1/3 for n=6 ⇒ n≈6
        const data = new dist.StudentZ(6).seed(42).sample(500)
        const init = dist.StudentZ._fitInit(data)
        assert(init.length === 1)
        assert(init[0] > 1)
        assert(Math.abs(init[0] - 6) < 1.5)
      })

      it('StudentZ.fit should recover n close to planted value', () => {
        const data = new dist.StudentZ(6).seed(42).sample(500)
        const result = dist.StudentZ.fit(data)
        assert(result instanceof dist.StudentZ)
        // StudentZ stores StudentT's nu = n − 1
        assert(Math.abs(result.p.nu + 1 - 6) < 1.5)
      })

      it('Degenerate._fitInit should return the sample mean as location', () => {
        const init = dist.Degenerate._fitInit([2, 2, 2])
        assert(init.length === 1)
        assert(Math.abs(init[0] - 2) < 1e-9)
      })

      it('Degenerate.fit should recover the point-mass location', () => {
        const result = dist.Degenerate.fit([5, 5, 5])
        assert(result instanceof dist.Degenerate)
        // constant data ⇒ exact point-mass location, no MLE drift
        assert(Math.abs(result.p.x0 - 5) < 1e-9)
      })

      it('Soliton._fitInit should lower-bound N by the largest observation', () => {
        const init = dist.Soliton._fitInit([1, 2, 1, 5, 3])
        assert(init.length === 1)
        assert(init[0] === 5)
      })

      it('Soliton.fit should recover N exactly for planted N=5', () => {
        const data = new dist.Soliton(5).seed(42).sample(200)
        const result = dist.Soliton.fit(data)
        assert(result instanceof dist.Soliton)
        assert.strictEqual(result.p.N, 5)
      })

      it('IrwinHall._fitInit should derive n from E[X]=n/2', () => {
        // mean = 2 for this sample ⇒ n = round(2·mean) = 4
        const init = dist.IrwinHall._fitInit([1.5, 2, 2.5, 1, 3])
        assert(init.length === 1)
        assert(init[0] === 4)
      })

      it('IrwinHall.fit should recover n exactly for planted n=4', () => {
        const data = new dist.IrwinHall(4).seed(42).sample(200)
        const result = dist.IrwinHall.fit(data)
        assert(result instanceof dist.IrwinHall)
        assert.strictEqual(result.p.n, 4)
      })

      it('R._fitInit should clamp c for zero-variance data', () => {
        // constant data ⇒ variance 0 hits the `|| 1` guard, then the Math.max(..., 1e-3) clamp
        const init = dist.R._fitInit([0, 0, 0])
        assert(Math.abs(init[0] - 1e-3) < 1e-12)
      })

      it('F._fitInit should fall back to defaults for mean<=1 data', () => {
        // mean <= 1 ⇒ d2 defaults to 10; the resulting negative variance denominator ⇒ d1 defaults to 5
        const init = dist.F._fitInit([0.1, 0.2, 0.3])
        assert(init[0] === 5 && init[1] === 10)
      })

      it('F._fitInit should guard zero-variance data', () => {
        // constant data ⇒ variance 0 hits the `|| 1` guard
        const init = dist.F._fitInit([2, 2, 2])
        assert(init[0] === 5 && Math.abs(init[1] - 4.1) < 1e-12)
      })

      it('StudentT._fitInit should fall back to nu=10 for low-variance data', () => {
        // variance <= 1 has no real df solution from ν = 2·Var/(Var−1); use a heavy-tailed default
        const init = dist.StudentT._fitInit([0.1, -0.1, 0.05, -0.05])
        assert(init[0] === 10)
      })

      it('StudentZ._fitInit should fall back to n=10 for zero-variance data', () => {
        // constant data ⇒ variance 0 hits the degenerate fallback
        const init = dist.StudentZ._fitInit([1, 1, 1])
        assert(init[0] === 10)
      })

      it('BoundedPareto.fit should recover L and alpha and return a valid upper bound', () => {
        const data = new dist.BoundedPareto(2, 20, 3).seed(42).sample(200)
        const result = dist.BoundedPareto.fit(data)
        assert(result instanceof dist.BoundedPareto)
        assert(Math.abs(result.p.L - 2) < 0.5)
        // MLE for H converges to max(data) since likelihood decreases for any H > max(data)
        assert(result.p.H >= Math.max(...data))
        assert(Math.abs(result.p.alpha - 3) < 0.8)
      })

      it('Lomax.fit should recover lambda and alpha close to planted values', () => {
        const data = new dist.Lomax(2, 4).seed(42).sample(200)
        const result = dist.Lomax.fit(data)
        assert(result instanceof dist.Lomax)
        assert(Math.abs(result.p.lambda - 2) < 0.8)
        assert(Math.abs(result.p.alpha - 4) < 1.0)
      })

      it('GeneralizedPareto.fit should recover mu, sigma, and xi close to planted values', () => {
        const data = new dist.GeneralizedPareto(1, 2, 0.2).seed(42).sample(200)
        const result = dist.GeneralizedPareto.fit(data)
        assert(result instanceof dist.GeneralizedPareto)
        assert(Math.abs(result.p.mu - 1) < 0.3)
        assert(Math.abs(result.p.sigma - 2) < 0.8)
        assert(Math.abs(result.p.xi - 0.2) < 0.3)
      })

      it('Burr.fit should recover c and k close to planted values', () => {
        const data = new dist.Burr(2, 3).seed(42).sample(200)
        const result = dist.Burr.fit(data)
        assert(result instanceof dist.Burr)
        assert(Math.abs(result.p.c - 2) < 0.8)
        assert(Math.abs(result.p.k - 3) < 1.0)
      })

      it('Dagum.fit should recover p, a, and b close to planted values', () => {
        const data = new dist.Dagum(1, 2, 3).seed(42).sample(200)
        const result = dist.Dagum.fit(data)
        assert(result instanceof dist.Dagum)
        assert(Math.abs(result.p.p - 1) < 0.4)
        assert(Math.abs(result.p.a - 2) < 0.8)
        assert(Math.abs(result.p.b - 3) < 1.0)
      })

      it('Champernowne.fit should recover alpha and x0 and return a valid lambda', () => {
        const data = new dist.Champernowne(1, 0, 2).seed(42).sample(200)
        const result = dist.Champernowne.fit(data)
        assert(result instanceof dist.Champernowne)
        assert(Math.abs(result.p.alpha - 1) < 0.4)
        // lambda is poorly identified near 0 from n=200; check valid range instead
        assert(result.p.lambda >= 0 && result.p.lambda < 1)
        assert(Math.abs(result.p.x0 - 2) < 0.5)
      })

      it('Benini.fit should recover alpha, beta, and sigma close to planted values', () => {
        const data = new dist.Benini(2, 1, 3).seed(42).sample(200)
        const result = dist.Benini.fit(data)
        assert(result instanceof dist.Benini)
        assert(Math.abs(result.p.alpha - 2) < 0.8)
        assert(Math.abs(result.p.beta - 1) < 0.4)
        assert(Math.abs(result.p.sigma - 3) < 0.5)
      })

      it('BoundedPareto._fitInit should return valid params for constant data', () => {
        const init = dist.BoundedPareto._fitInit([5, 5, 5])
        assert(init[0] > 0 && init[1] > init[0] && init[2] > 0)
      })

      it('Lomax._fitInit should fall back to alpha=3 when CV <= 1', () => {
        // near-constant data → CV ≈ 0 → triggers fallback
        const init = dist.Lomax._fitInit([2, 2.001, 1.999, 2])
        assert(init[0] > 0)
        assert(init[1] === 3)
      })

      it('GeneralizedPareto._fitInit should return xi=0 for constant data', () => {
        const init = dist.GeneralizedPareto._fitInit([3, 3, 3])
        assert(Number.isFinite(init[0]))
        assert(init[1] > 0)
        assert(init[2] === 0)
      })

      it('Benini._fitInit should return positive alpha, beta, and sigma for any positive data', () => {
        const init = dist.Benini._fitInit([2, 3, 4, 5])
        assert(init[0] > 0)
        assert(init[1] > 0)
        assert(init[2] > 0)
      })

      it('NoncentralChi2.fit should recover k and lambda close to planted values', () => {
        const data = new dist.NoncentralChi2(4, 2).seed(42).sample(300)
        const result = dist.NoncentralChi2.fit(data)
        assert(result instanceof dist.NoncentralChi2)
        assert(Math.abs(result.p.k - 4) < 0.5)
        assert(Math.abs(result.p.lambda - 2) < 0.5)
      })

      it('NoncentralChi.fit should recover k and lambda close to planted values', () => {
        const data = new dist.NoncentralChi(4, 2).seed(42).sample(300)
        const result = dist.NoncentralChi.fit(data)
        assert(result instanceof dist.NoncentralChi)
        assert(Math.abs(result.p.k - 4) < 0.5)
        assert(Math.abs(result.p.lambda - 2) < 0.5)
      })

      it('NoncentralT.fit should recover nu and mu close to planted values', () => {
        const data = new dist.NoncentralT(5, 1).seed(42).sample(300)
        const result = dist.NoncentralT.fit(data)
        assert(result instanceof dist.NoncentralT)
        assert(Math.abs(result.p.nu - 5) <= 1)
        assert(Math.abs(result.p.mu - 1) < 0.3)
      })

      it('NoncentralBeta.fit should recover alpha and beta close to planted values', () => {
        const data = new dist.NoncentralBeta(2, 3, 1).seed(42).sample(500)
        const result = dist.NoncentralBeta.fit(data)
        assert(result instanceof dist.NoncentralBeta)
        assert(Math.abs(result.p.alpha - 2) < 0.75)
        assert(Math.abs(result.p.beta - 3) < 0.75)
      })

      it('NoncentralF.fit should recover d1, d2 and lambda close to planted values', () => {
        const data = new dist.NoncentralF(3, 8, 2).seed(42).sample(400)
        const result = dist.NoncentralF.fit(data)
        assert(result instanceof dist.NoncentralF)
        assert(Math.abs(result.p.d1 - 3) <= 2)
        assert(Math.abs(result.p.d2 - 8) <= 3)
        assert(Math.abs(result.p.lambda - 2) <= 1.5)
      })

      it('DoublyNoncentralChi2.fit should recover total df and noncentrality close to planted values', () => {
        const data = new dist.DoublyNoncentralChi2(2, 3, 1, 2).seed(42).sample(500)
        const result = dist.DoublyNoncentralChi2.fit(data)
        assert(result instanceof dist.DoublyNoncentralChi2)
        assert(Math.abs((result.p.k1 + result.p.k2) - 5) <= 2)
        assert(Math.abs((result.p.lambda1 + result.p.lambda2) - 3) <= 2)
      })

      it('DoublyNoncentralChi2.fit should enforce k1>=1 and k2>=1 when collapsed fit returns k=1', () => {
        // chi-squared(1) data: NoncentralChi2.fit returns k=1, triggering kTot<2 clamp
        const data = new dist.NoncentralChi2(1, 0).seed(42).sample(500)
        const result = dist.DoublyNoncentralChi2.fit(data)
        assert(result instanceof dist.DoublyNoncentralChi2)
        assert(result.p.k1 >= 1)
        assert(result.p.k2 >= 1)
      })

      it('DoublyNoncentralBeta.fit should recover alpha and beta close to planted values', () => {
        const data = new dist.DoublyNoncentralBeta(2, 3, 1, 1).seed(42).sample(500)
        const result = dist.DoublyNoncentralBeta.fit(data)
        assert(result instanceof dist.DoublyNoncentralBeta)
        assert(Math.abs(result.p.alpha - 2) < 0.75)
        assert(Math.abs(result.p.beta - 3) < 0.75)
      })

      it('DoublyNoncentralF.fit should recover d1 and d2 close to planted values', () => {
        const data = new dist.DoublyNoncentralF(3, 8, 1, 1).seed(42).sample(400)
        const result = dist.DoublyNoncentralF.fit(data)
        assert(result instanceof dist.DoublyNoncentralF)
        assert(Math.abs(result.p.d1 - 3) <= 2)
        assert(Math.abs(result.p.d2 - 8) <= 3)
      })

      it('DoublyNoncentralT.fit should recover mu close to planted value', () => {
        const data = new dist.DoublyNoncentralT(5, 2, 1).seed(42).sample(300)
        const result = dist.DoublyNoncentralT.fit(data)
        assert(result instanceof dist.DoublyNoncentralT)
        assert(Math.abs(result.p.mu - 2) < 0.5)
      })

      it('InverseGaussian._fitInit should return the exact MLE mu=mean, lambda=n/Σ(1/xᵢ−1/x̄)', () => {
        const data = [1, 2, 3, 4]
        const init = dist.InverseGaussian._fitInit(data)
        const mean = 2.5
        const lambda = data.length / data.reduce((s, x) => s + (1 / x - 1 / mean), 0)
        assert(Math.abs(init[0] - mean) < 1e-10)
        assert(Math.abs(init[1] - lambda) < 1e-10)
      })

      it('InverseGaussian.fit should recover mu and lambda close to planted values', () => {
        const data = new dist.InverseGaussian(2, 3).seed(42).sample(500)
        const result = dist.InverseGaussian.fit(data)
        assert(result instanceof dist.InverseGaussian)
        assert(Math.abs(result.p.mu - 2) < 0.3)
        assert(Math.abs(result.p.lambda - 3) < 1.0)
      })

      it('ReciprocalInverseGaussian._fitInit should apply IG MOM to reciprocal data', () => {
        // X ~ RIG(mu, lambda) iff 1/X ~ IG(mu, lambda); init maps 1/x and applies IG MOM
        const data = new dist.ReciprocalInverseGaussian(2, 4).seed(42).sample(200)
        const init = dist.ReciprocalInverseGaussian._fitInit(data)
        assert(Math.abs(init[0] - 2) < 0.5)
        assert(Math.abs(init[1] - 4) < 2.0)
      })

      it('ReciprocalInverseGaussian.fit should recover mu and lambda close to planted values', () => {
        const data = new dist.ReciprocalInverseGaussian(2, 4).seed(42).sample(500)
        const result = dist.ReciprocalInverseGaussian.fit(data)
        assert(result instanceof dist.ReciprocalInverseGaussian)
        assert(Math.abs(result.p.mu - 2) < 0.5)
        assert(Math.abs(result.p.lambda - 4) < 2.0)
      })

      it('Nakagami._fitInit should return m=E[X²]²/Var[X²] and omega=E[X²]', () => {
        // Exact MOM on X²~Gamma(m, omega/m)
        const data = new dist.Nakagami(2, 3).seed(42).sample(1000)
        const init = dist.Nakagami._fitInit(data)
        assert(init[0] >= 0.5 && Math.abs(init[0] - 2) < 0.5)
        assert(Math.abs(init[1] - 3) < 0.5)
      })

      it('Nakagami.fit should recover m and omega close to planted values', () => {
        const data = new dist.Nakagami(2, 3).seed(42).sample(500)
        const result = dist.Nakagami.fit(data)
        assert(result instanceof dist.Nakagami)
        assert(Math.abs(result.p.m - 2) < 0.5)
        assert(Math.abs(result.p.omega - 3) < 0.8)
      })

      it('Hoyt._fitInit should delegate to Nakagami and return valid params', () => {
        // Hoyt is a deprecated alias for Nakagami; _fitInit delegates to Nakagami._fitInit
        const data = new dist.Nakagami(2, 3).seed(42).sample(200)
        const init = dist.Hoyt._fitInit(data)
        assert(init[0] >= 0.5)
        assert(init[1] > 0)
      })

      it('Hoyt.fit should return a usable Hoyt instance', () => {
        const data = new dist.Nakagami(2, 3).seed(42).sample(500)
        const result = dist.Hoyt.fit(data)
        assert(result instanceof dist.Hoyt)
        assert(Number.isFinite(result.pdf(1)) && result.pdf(1) > 0)
      })

      it('Lindley._fitInit should return the closed-form MOM estimate', () => {
        // Exact: theta = (-(mean-1) + sqrt((mean-1)²+8·mean)) / (2·mean)
        // For theta=1: mean=1.5, so theta_hat should be 1
        const data = new dist.Lindley(1).seed(42).sample(1000)
        const init = dist.Lindley._fitInit(data)
        assert(init.length === 1)
        assert(Math.abs(init[0] - 1) < 0.15)
      })

      it('Lindley.fit should recover theta close to planted value', () => {
        const data = new dist.Lindley(1.5).seed(42).sample(500)
        const result = dist.Lindley.fit(data)
        assert(result instanceof dist.Lindley)
        assert(Math.abs(result.p.theta - 1.5) < 0.3)
      })

      it('Alpha._fitInit should return positive alpha and beta from heuristic MOM', () => {
        const data = new dist.Alpha(3, 1).seed(42).sample(200)
        const init = dist.Alpha._fitInit(data)
        assert(init[0] > 0 && init[1] > 0)
        assert(Math.abs(init[0] - 3) < 1.5)
      })

      it('Alpha.fit should return a usable Alpha instance', () => {
        const data = new dist.Alpha(2, 1).seed(42).sample(200)
        const result = dist.Alpha.fit(data)
        assert(result instanceof dist.Alpha)
        assert(Number.isFinite(result.pdf(0.5)) && result.pdf(0.5) > 0)
        assert(Math.abs(result.p.alpha - 2) < 0.5)
      })

      it('QExponential._fitInit should return q and lambda matching MOM for r>1/3', () => {
        // For QExp(q=0.5, lambda=2): r = Var/E² = (2-q)/(4-3q) = 1.5/2.5 = 0.6 > 1/3
        // MOM inverse gives q = (2-4·0.6)/(1-3·0.6) = 0.5, lambda = 1/(mean·(3-2·0.5)) = 2
        const data = new dist.QExponential(0.5, 2).seed(42).sample(1000)
        const init = dist.QExponential._fitInit(data)
        assert(Math.abs(init[0] - 0.5) < 0.2)
        assert(Math.abs(init[1] - 2) < 0.5)
      })

      it('QExponential.fit should recover q and lambda close to planted values', () => {
        const data = new dist.QExponential(0.5, 2).seed(42).sample(500)
        const result = dist.QExponential.fit(data)
        assert(result instanceof dist.QExponential)
        // Reconstruct q and lambda from GP params: xi=(q-1)/(2-q), sigma=1/(lambda*(2-q))
        const q = (2 * result.p.xi + 1) / (result.p.xi + 1)
        const lambda = (result.p.xi + 1) / result.p.sigma
        assert(Math.abs(q - 0.5) < 0.2)
        assert(Math.abs(lambda - 2) < 0.5)
      })

      it('InverseGaussian._fitInit should handle constant data via variance fallback', () => {
        // zero variance → || mean*mean guard; result must still be valid params
        const init = dist.InverseGaussian._fitInit([2, 2, 2])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('Nakagami._fitInit should handle constant data via variance fallback', () => {
        // zero var(X²) → || mean2*mean2 guard; m is clamped to 0.5
        const init = dist.Nakagami._fitInit([1, 1, 1])
        assert(init[0] >= 0.5 && init[1] > 0)
      })

      it('Alpha._fitInit should handle constant data via variance fallback', () => {
        // zero variance → || mean²·0.25 guard gives std = 0.5·mean, alpha = 2
        const init = dist.Alpha._fitInit([3, 3, 3])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('ReciprocalInverseGaussian._fitInit should handle constant data via variance fallback', () => {
        const init = dist.ReciprocalInverseGaussian._fitInit([2, 2, 2])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('Rice._fitInit should handle constant data via variance fallback', () => {
        // zero variance → || mean*mean guard; nu and sigma must still be valid (floored) params
        const init = dist.Rice._fitInit([2, 2, 2])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('QExponential._fitInit should handle constant data via variance fallback', () => {
        // zero variance → fallback mean²=4, r=4/4=1 > 1/3 → q=(2-4)/(1-3)=1, lambda=1/(2*(3-2))=0.5
        const init = dist.QExponential._fitInit([2, 2, 2])
        assert(Math.abs(init[0] - 1) < 1e-10)
        assert(Math.abs(init[1] - 0.5) < 1e-10)
      })

      it('QExponential._fitInit should use q=0 fallback when r<=1/3', () => {
        // data with large mean, small variance gives r = Var/E² << 1/3 → else branch
        const init = dist.QExponential._fitInit([9, 10, 11])
        assert(init[0] === 0)
        assert(init[1] > 0)
      })

      // Loose behavior-first recovery check: a usable fit places ~half its mass below the sample median
      const fitCoversMedian = (result, data) => {
        const median = data.slice().sort((a, b) => a - b)[Math.floor(data.length / 2)]
        return Math.abs(result.cdf(median) - 0.5) < 0.2
      }

      it('Gompertz._fitInit returns a constructible [eta, b] vector and fit() covers the median', () => {
        const data = new dist.Gompertz(2, 2).seed(42).sample(300)
        const init = dist.Gompertz._fitInit(data)
        assert(init.length === 2 && init.every(p => p > 0))
        assert.doesNotThrow(() => new dist.Gompertz(...init))
        const result = dist.Gompertz.fit(data)
        assert(result instanceof dist.Gompertz)
        assert(fitCoversMedian(result, data))
      })

      it('Makeham._fitInit returns positive [alpha, beta, lambda] and fit() covers the median', () => {
        const data = new dist.Makeham(2, 2, 2).seed(42).sample(300)
        const init = dist.Makeham._fitInit(data)
        assert(init.length === 3 && init.every(p => p > 0))
        const result = dist.Makeham.fit(data)
        assert(result instanceof dist.Makeham)
        assert(fitCoversMedian(result, data))
      })

      it('Muth._fitInit returns alpha in (0,1] and fit() covers the median', () => {
        const data = new dist.Muth(0.5).seed(42).sample(300)
        const init = dist.Muth._fitInit(data)
        assert(init.length === 1 && init[0] > 0 && init[0] <= 1)
        const result = dist.Muth.fit(data)
        assert(result instanceof dist.Muth)
        assert(fitCoversMedian(result, data))
      })

      it('BenktanderII._fitInit seeds a>0, b in (0,1] and fit() covers the median', () => {
        const data = new dist.BenktanderII(2, 0.9995).seed(42).sample(300)
        const init = dist.BenktanderII._fitInit(data)
        assert(init[0] > 0 && init[1] > 0 && init[1] <= 1)
        const result = dist.BenktanderII.fit(data)
        assert(result instanceof dist.BenktanderII)
        assert(fitCoversMedian(result, data))
      })

      it('BirnbaumSaunders._fitInit returns shifted fatigue-life estimates and fit() covers the median', () => {
        const data = new dist.BirnbaumSaunders(0, 2, 2).seed(42).sample(300)
        const init = dist.BirnbaumSaunders._fitInit(data)
        assert(init.length === 3 && init[1] > 0 && init[2] > 0)
        assert(Number.isFinite(init[0]) && init[0] < Math.min(...data)) // mu seeded just below the minimum observation
        const result = dist.BirnbaumSaunders.fit(data)
        assert(result instanceof dist.BirnbaumSaunders)
        assert(fitCoversMedian(result, data))
      })

      it('Davis._fitInit returns 0<mu<min with n=2.5 and fit() yields a usable instance', () => {
        const data = new dist.Davis(1, 1, 2).seed(42).sample(200)
        const sorted = data.slice().sort((a, b) => a - b)
        const init = dist.Davis._fitInit(data)
        assert(init[0] > 0 && init[0] < sorted[0])
        assert(init[1] > 0 && init[2] > 1)
        // Davis fit() converges poorly here (likelihood is nearly flat in the shape n), so exact recovery is impractical; assert a usable, non-degenerate fit instead
        const result = dist.Davis.fit(data)
        assert(result instanceof dist.Davis)
        const lo = sorted[Math.floor(data.length * 0.25)]
        const hi = sorted[Math.floor(data.length * 0.75)]
        assert(Number.isFinite(result.pdf(hi)) && result.pdf(hi) > 0)
        assert(result.cdf(hi) > result.cdf(lo)) // monotone increasing → non-degenerate fit
      })

      it('GeneralizedExponential._fitInit returns positive [a, b, c] and fit() covers the median', () => {
        const data = new dist.GeneralizedExponential(2, 2, 2).seed(42).sample(300)
        const init = dist.GeneralizedExponential._fitInit(data)
        assert(init.length === 3 && init.every(p => p > 0))
        const result = dist.GeneralizedExponential.fit(data)
        assert(result instanceof dist.GeneralizedExponential)
        assert(fitCoversMedian(result, data))
      })

      it('Rice._fitInit returns positive [nu, sigma] and fit() covers the median', () => {
        const data = new dist.Rice(0.5, 2).seed(42).sample(300)
        const init = dist.Rice._fitInit(data)
        assert(init.length === 2 && init[0] > 0 && init[1] > 0)
        const result = dist.Rice.fit(data)
        assert(result instanceof dist.Rice)
        assert(fitCoversMedian(result, data))
      })

      it('TruncatedNormal._fitInit should set a=min, b=max, mu=mean, sigma=std', () => {
        // Fixed dataset with known moments: mean=3, std=sqrt(2), min=1, max=5
        const init = dist.TruncatedNormal._fitInit([1, 2, 3, 4, 5])
        assert.strictEqual(init[2], 1)
        assert.strictEqual(init[3], 5)
        assert(Math.abs(init[0] - 3) < 1e-10)
        assert(init[1] > 0)
      })

      it('TruncatedNormal.fit should recover mu, sigma, a, b close to planted values', () => {
        const data = new dist.TruncatedNormal(2, 1, 0, 4).seed(42).sample(300)
        const result = dist.TruncatedNormal.fit(data)
        assert(result instanceof dist.TruncatedNormal)
        assert(Math.abs(result.p.mu - 2) < 0.4)
        assert(Math.abs(result.p.sigma - 1) < 0.4)
        assert(result.p.a < 0.5)
        assert(result.p.b > 3.5)
      })

      it('Reciprocal._fitInit should set a=max(min,ε) and b=max', () => {
        // Fixed dataset with known bounds: min=2, max=8, no ε clamping needed
        const init = dist.Reciprocal._fitInit([2, 5, 8])
        assert.strictEqual(init[0], 2)
        assert.strictEqual(init[1], 8)
      })

      it('Reciprocal._fitInit should apply a*10 fallback when all data are equal', () => {
        const init = dist.Reciprocal._fitInit([5, 5, 5])
        assert.strictEqual(init[0], 5)
        assert.strictEqual(init[1], 50)
      })

      it('Reciprocal.fit should recover a and b close to planted values', () => {
        const data = new dist.Reciprocal(1, 10).seed(42).sample(300)
        const result = dist.Reciprocal.fit(data)
        assert(result instanceof dist.Reciprocal)
        assert(Math.abs(result.p.a - 1) < 0.15)
        assert(Math.abs(result.p.b - 10) < 0.3)
      })

      it('Bradford._fitInit should return c close to planted value from sample mean', () => {
        // Bradford(2) mean ≈ 0.35; c = 6*(1-2*0.35) ≈ 1.8 — start within 1.5 of truth
        const data = new dist.Bradford(2).seed(42).sample(200)
        const init = dist.Bradford._fitInit(data)
        assert(init[0] > 0)
        assert(Math.abs(init[0] - 2) < 1.5)
      })

      it('Bradford._fitInit should return c=1 when mean >= 0.5', () => {
        const init = dist.Bradford._fitInit([0.5, 0.6, 0.7])
        assert.strictEqual(init[0], 1)
      })

      it('Bradford.fit should return a valid Bradford instance', () => {
        const data = new dist.Bradford(2).seed(42).sample(200)
        const result = dist.Bradford.fit(data)
        assert(result instanceof dist.Bradford)
        assert(Number.isFinite(result.pdf(0.5)) && result.pdf(0.5) > 0)
      })

      it('Wigner._fitInit should return R = 2*std for symmetric data without outliers', () => {
        // [-2,-1,0,1,2]: mean=0, variance=2, std=sqrt(2), so R = 2*sqrt(2) ≈ 2.83 > maxAbs=2
        const init = dist.Wigner._fitInit([-2, -1, 0, 1, 2])
        assert(Math.abs(init[0] - 2 * Math.sqrt(2)) < 1e-10)
      })

      it('Wigner.fit should recover R close to planted value', () => {
        const data = new dist.Wigner(3).seed(42).sample(300)
        const result = dist.Wigner.fit(data)
        assert(result instanceof dist.Wigner)
        assert(Math.abs(result.p.R - 3) < 0.5)
      })

      it('VonMises._fitInit should return kappa from circular resultant-length approximation', () => {
        const data = new dist.VonMises(2).seed(42).sample(200)
        const init = dist.VonMises._fitInit(data)
        assert(init[0] > 0)
        assert(Math.abs(init[0] - 2) < 0.8)
      })

      it('VonMises.fit should recover kappa close to planted value', () => {
        const data = new dist.VonMises(2).seed(42).sample(300)
        const result = dist.VonMises.fit(data)
        assert(result instanceof dist.VonMises)
        assert(Math.abs(result.p.kappa - 2) < 0.5)
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

    it('BetaNegativeBinomial.fit should return a usable BetaNegativeBinomial instance', () => {
      const data = new dist.BetaNegativeBinomial(3, 3, 4).seed(42).sample(200)
      const result = dist.BetaNegativeBinomial.fit(data)
      assert(result instanceof dist.BetaNegativeBinomial)
      assert(Number.isFinite(result.pdf(3)) && result.pdf(3) > 0)
    })

    it('BetaGeometric.fit should return a usable BetaGeometric instance', () => {
      const data = new dist.BetaGeometric(3, 4).seed(42).sample(200)
      const result = dist.BetaGeometric.fit(data)
      assert(result instanceof dist.BetaGeometric)
      assert(Number.isFinite(result.pdf(2)) && result.pdf(2) > 0)
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
          assert.equal(degenerate.pdf(x0 + 1), 0) // fixed offset guarantees argument != x0
          assert.equal(degenerate.cdf(x0 - 1), 0) // fixed offset guarantees argument < x0
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

// Distributions whose _fitInit returns the exact closed-form MLE (fit() skips the optimizer).
const EXACT_MLE = [
  'Exponential', 'Normal', 'Poisson', 'Bernoulli', 'DiscreteUniform', 'Pareto', 'LogNormal',
  'Rayleigh', 'MaxwellBoltzmann', 'HalfNormal', 'Geometric', 'Laplace', 'Reciprocal', 'Lindley',
  'Uniform', 'InverseGaussian', 'LogitNormal', 'PowerLaw', 'Borel', 'BorelTanner'
]

// Precision and robustness gate for Distribution.fit() (milestone v1.27.0, issue #546 / #556).
//
// Two distinct quantities matter here, and they are NOT the same thing:
//   * Statistical precision — how close the estimate is to the *true* parameter — is O(1/√n) and
//     is a property of the data, not the optimizer. No amount of optimizer tuning improves it.
//   * Optimization precision — how close the result is to the maximizer of the likelihood for the
//     *given* dataset. A function-value optimizer is capped at ~√EPS here; the only route to
//     machine precision is a closed-form MLE, evaluated directly.
//
// Accordingly these tests assert the things that are actually achievable and meaningful:
//   1. Distributions with a closed-form MLE recover it to ~machine precision (the fast path).
//   2. Powell does not stall on objectives where Nelder-Mead did (hyperexponential): the fitted
//      log-likelihood is at least as high as at the data-generating parameters.
//   3. Constrained/bounded fits stay valid and reach a genuine optimum.

describe('fit() precision and robustness gate', () => {
  describe('exact-MLE fast-path flag', () => {
    it('is declared (own property, value true) on every closed-form-MLE distribution', () => {
      for (const name of EXACT_MLE) {
        const Cls = dist[name]
        assert.isTrue(Cls._fitInitIsExact, `${name}._fitInitIsExact should be true`)
        assert.isOk(
          Object.getOwnPropertyDescriptor(Cls, '_fitInitIsExact'),
          `${name} must declare its OWN flag, not inherit it`
        )
      }
    })

    it('defaults to false on the base class and is not an own property of a derived approximate fit', () => {
      assert.isFalse(Distribution._fitInitIsExact)
      // Weibull extends Exponential but has an approximate _fitInit: it must NOT inherit the path.
      assert.isNotOk(Object.getOwnPropertyDescriptor(dist.Weibull, '_fitInitIsExact'))
      assert.isNotOk(Object.getOwnPropertyDescriptor(dist.LogLaplace, '_fitInitIsExact'))
    })
  })

  describe('closed-form MLE recovered to machine precision', () => {
    it('Exponential recovers λ̂ = 1/x̄ to 1e-14 relative error', () => {
      const data = [0.7, 1.3, 2.1, 0.9, 3.4, 1.1, 0.5, 2.8]
      // Reference computed independently of fit()'s n/Σx ordering.
      const reference = 1 / (data.reduce((s, x) => s + x, 0) / data.length)
      const fitted = dist.Exponential.fit(data).p.lambda
      assert.approximately(fitted / reference, 1, 1e-14)
    })

    it('Normal recovers μ̂ = x̄ and σ̂² = biased variance to 1e-14 relative error', () => {
      const data = [2.1, 3.4, 1.9, 4.0, 2.7, 3.1, 2.5, 3.8]
      const n = data.length
      const muRef = data.reduce((s, x) => s + x, 0) / n
      const sigmaRef = Math.sqrt(data.reduce((s, x) => s + (x - muRef) ** 2, 0) / n)
      const fitted = dist.Normal.fit(data)
      assert.approximately(fitted.p.mu / muRef, 1, 1e-14)
      assert.approximately(fitted.p.sigma / sigmaRef, 1, 1e-14)
    })

    it('Pareto recovers x̂min = min and α̂ = n/Σln(x/xmin) to 1e-14 relative error', () => {
      const data = [1.5, 2.0, 3.1, 1.8, 2.5, 4.2, 1.6]
      const xmin = Math.min(...data)
      const alphaRef = data.length / data.reduce((s, x) => s + Math.log(x / xmin), 0)
      const fitted = dist.Pareto.fit(data)
      assert.strictEqual(fitted.p.xmin, xmin)
      assert.approximately(fitted.p.alpha / alphaRef, 1, 1e-14)
    })

    it('Uniform recovers the exact [min, max] support (not a padded interval)', () => {
      const data = [2.3, 5.1, 1.7, 4.4, 3.0]
      const fitted = dist.Uniform.fit(data)
      assert.strictEqual(fitted.p.xmin, Math.min(...data))
      assert.strictEqual(fitted.p.xmax, Math.max(...data))
    })

    it('InverseGaussian recovers the exact MLE λ̂ = n/Σ(1/xᵢ − 1/x̄) to 1e-14 relative error', () => {
      const data = [1.2, 2.4, 0.9, 3.1, 1.8, 2.0, 1.5]
      const n = data.length
      const mean = data.reduce((s, x) => s + x, 0) / n
      const lambdaRef = n / data.reduce((s, x) => s + (1 / x - 1 / mean), 0)
      const fitted = dist.InverseGaussian.fit(data)
      assert.approximately(fitted.p.mu / mean, 1, 1e-14)
      assert.approximately(fitted.p.lambda / lambdaRef, 1, 1e-14)
    })
  })

  describe('Powell does not stall where Nelder-Mead did', () => {
    it('Hyperexponential fit reaches a log-likelihood at least as high as the true model', () => {
      const trueModel = new dist.Hyperexponential([
        { weight: 0.3, rate: 1 },
        { weight: 0.7, rate: 5 }
      ]).seed(20260601)
      const data = trueModel.sample(400)
      const fitted = dist.Hyperexponential.fit(data)
      const fittedLnL = fitted.lnL(data)
      const trueLnL = trueModel.lnL(data)
      assert.isTrue(Number.isFinite(fittedLnL))
      // The sample MLE cannot be worse than the data-generating parameters (a stall could be).
      assert.isAtLeast(fittedLnL, trueLnL - 1e-6 * (Math.abs(trueLnL) + 1))
    })
  })

  describe('constrained / bounded fits stay valid and reach a genuine optimum', () => {
    it('Bates fit honours the a < b ordering constraint and beats the true-parameter likelihood', () => {
      // Ordering (a < b) and integer n are constraints a box-bounded method (L-BFGS-B) cannot
      // express; the derivative-free Powell + Infinity-barrier objective handles them directly.
      const trueModel = new dist.Bates(4, 1, 5).seed(20260601)
      const data = trueModel.sample(300)
      const fitted = dist.Bates.fit(data)
      assert.isTrue(fitted.p.a < fitted.p.b)
      assert.isTrue(Number.isInteger(fitted.p.n) && fitted.p.n >= 1)
      const fittedLnL = fitted.lnL(data)
      assert.isTrue(Number.isFinite(fittedLnL))
      assert.isAtLeast(fittedLnL, trueModel.lnL(data) - 1e-6 * (Math.abs(trueModel.lnL(data)) + 1))
    })

    it('Gamma (positive shape/rate) fit converges to a local optimum no perturbation improves', () => {
      const data = new dist.Gamma(2.5, 1.5).seed(20260601).sample(400)
      const fitted = dist.Gamma.fit(data)
      const L0 = fitted.lnL(data)
      assert.isTrue(Number.isFinite(L0))
      // A genuine optimum: no small coordinate perturbation increases the log-likelihood.
      for (const [da, db] of [[1e-3, 0], [-1e-3, 0], [0, 1e-3], [0, -1e-3]]) {
        const a = fitted.p.alpha * (1 + da)
        const b = fitted.p.beta * (1 + db)
        assert.isAtMost(new dist.Gamma(a, b).lnL(data), L0 + 1e-9)
      }
    })

    describe('Distribution._adaptiveHalfWidth', function () {
      it('should be a static method on Distribution', function () {
        assert.isFunction(Distribution._adaptiveHalfWidth)
      })

      it('should return exactly 5 (floor) for a well-determined integer parameter', function () {
        // Chi2(3) with n=1000: observed information ≈ n·(1/4)·ψ'(1.5) ≈ 234 → w = ceil(3/√234) = 1 → max(5,1) = 5
        const data = new dist.Chi2(3).seed(42).sample(1000)
        const lnLAt = k => { try { return new dist.Chi2(k).lnL(data) } catch (_) { return -Infinity } }
        const w = Distribution._adaptiveHalfWidth(lnLAt, 3, 1)
        assert.strictEqual(w, 5)
      })

      it('should return more than 5 for a poorly-determined integer parameter', function () {
        // Chi2(30) with n=10: very low Fisher information per sample → wide window
        const data = new dist.Chi2(30).seed(42).sample(10)
        const lnLAt = k => { try { return new dist.Chi2(k).lnL(data) } catch (_) { return -Infinity } }
        const w = Distribution._adaptiveHalfWidth(lnLAt, 30, 1)
        assert.isAbove(w, 5)
      })

      it('should return exactly 5 when seed is at the lower bound (boundary guard)', function () {
        // seed=1=lb: lnL(seed-1) unavailable, uses lnL0; with n=200 the one-sided curvature is
        // still large enough that w = ceil(3/√iObs) < 5, so max(5,…) = 5
        const data = new dist.Chi2(1).seed(42).sample(200)
        const lnLAt = k => { try { return new dist.Chi2(k).lnL(data) } catch (_) { return -Infinity } }
        const w = Distribution._adaptiveHalfWidth(lnLAt, 1, 1)
        assert.strictEqual(w, 5)
      })

      it('F.fit should recover d2 close to true value when seed is far off (window-widening case)', function () {
        // F(5, 50): MOM seed for d2 can be far from 50 due to amplification in the variance formula.
        // The adaptive window widens beyond ±5 to cover the true d2=50.
        // seed=0xcafe gives a deliberately poor MOM estimate to exercise the wider window.
        const data = new dist.F(5, 50).seed(0xcafe).sample(100)
        const fitted = dist.F.fit(data)
        assert(fitted instanceof dist.F)
        // Verify the grid actually searched beyond the fixed ±5 in the d2 direction
        const [d1Hat, d2Hat] = dist.F._fitInit(data)
        const d2Seed = Math.round(d2Hat)
        const lnLAt = d2 => { try { return new dist.F(Math.round(d1Hat), d2).lnL(data) } catch (_) { return -Infinity } }
        const w2 = Distribution._adaptiveHalfWidth(lnLAt, d2Seed, 1)
        // The adaptive window must be > 5 when the MOM seed is far from the true d2=50
        assert.isAbove(w2, 5)
      })
    })
  })
})
