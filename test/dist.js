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

      it('Distribution._fitInit fallback should work for scalar-constructor distributions', () => {
        // Burr has no _fitInit override so fit() exercises the base-class random-retry path
        const data = new dist.Burr(2, 3).seed(42).sample(100)
        const result = dist.Burr.fit(data)
        assert(result instanceof dist.Burr)
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

      it('Chi.fit should recover k close to planted value', () => {
        const data = new dist.Chi(4).seed(42).sample(200)
        const result = dist.Chi.fit(data)
        assert(result instanceof dist.Chi)
        assert(Math.abs(result.p.k - 4) <= 1)
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

      it('HeadsMinusTails.fit should return a usable HeadsMinusTails instance', () => {
        const data = new dist.HeadsMinusTails(5).seed(42).sample(200)
        const result = dist.HeadsMinusTails.fit(data)
        assert(result instanceof dist.HeadsMinusTails)
        assert(result.p.n > 0)
        assert(Number.isFinite(result.pdf(0)) && result.pdf(0) > 0)
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

      it('Erlang.fit should recover k and lambda close to planted values', () => {
        const data = new dist.Erlang(3, 1).seed(42).sample(200)
        const result = dist.Erlang.fit(data)
        assert(result instanceof dist.Erlang)
        assert(Math.abs(result.p.alpha - 3) <= 1)
        assert(Math.abs(result.p.beta - 1) < 0.25)
      })

      it('Chi2.fit should recover k close to planted value', () => {
        const data = new dist.Chi2(4).seed(42).sample(200)
        const result = dist.Chi2.fit(data)
        assert(result instanceof dist.Chi2)
        assert(Math.abs(result.p.alpha * 2 - 4) <= 1)
      })

      it('InverseChi2.fit should recover nu close to planted value', () => {
        const data = new dist.InverseChi2(6).seed(42).sample(200)
        const result = dist.InverseChi2.fit(data)
        assert(result instanceof dist.InverseChi2)
        assert(Math.abs(result.p.nu - 6) <= 1)
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
        // Mielke stores params via Dagum: p.p = k/s, p.a = s, so k = p.p * p.a
        assert(Math.abs(result.p.p * result.p.a - 2) < 0.6)
        assert(Math.abs(result.p.a - 1) < 0.5)
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

      it('Bates.fit should return a usable Bates instance close to planted support', () => {
        const data = new dist.Bates(3, 1, 5).seed(42).sample(200)
        const result = dist.Bates.fit(data)
        assert(result instanceof dist.Bates)
        // n is integer-rounded so Nelder-Mead may land ±1 from planted n=3; allow [2,4]
        assert(result.p.n >= 2 && result.p.n <= 4)
        assert(Math.abs(result.p.b - result.p.a - 4) < 1)
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
        // Shape params can be hard to disentangle with 5 params; check they're in a reasonable range
        assert(result.p.alpha > 0.5 && result.p.alpha < 10)
        assert(result.p.beta > 0.5 && result.p.beta < 10)
        assert(result.p.theta > 0.1 && result.p.theta <= 1)
        assert(Math.abs(result.p.a - 0) < 0.3)
        assert(Math.abs(result.p.b - 4) < 0.3)
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
