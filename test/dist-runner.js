import { assert } from 'chai'
import { describe, it } from 'mocha'
import { Tests, checkRefVals, checkQuantileVals } from './test-utils'
import * as dist from '../src/dist'

// Constants.
const SAMPLE_SIZE = 10000

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
      assert(values1.every((d, i) => d === values2[i]))
    })

    it('should give different samples for different seeds', () => {
      const self = new dist[tc.name](...tc.cases[0].params())
      self.seed(123456789) // fixed seed so CI failures are reproducible
      const values1 = self.sample(sampleSize)
      self.seed(987654321) // different fixed seed to guarantee distinct sequence
      const values2 = self.sample(sampleSize)
      assert(values1.some((d, i) => d !== values2[i]))
    })
  },

  loadAndSave (tc) {
    const sampleSize = 100

    it('loaded state should continue where it was saved at', () => {
      // Create generator and seed
      const generator = new dist[tc.name](...tc.cases[0].params())
      const s = 123456789 // fixed seed so CI failures are reproducible
      const cut = Math.floor(sampleSize / 3)

      // Generate full sample from seeded generator
      generator.seed(s)
      const values = generator.sample(sampleSize)

      // Reset generator, create two sub samples
      generator.seed(s)
      const values1 = generator.sample(cut)
      const state = generator.save()
      const restored = dist[tc.name].load(state)
      const values2 = restored.sample(sampleSize - cut)

      // All values must match the seeded reference sequence
      assert(values1.concat(values2).every((d, i) => d === values[i]))
    })

    it('loaded state should copy full state of generator', () => {
      // Create seeded generator
      const generator1 = new dist[tc.name](...tc.cases[0].params())
      generator1.seed(123456789) // fixed seed so CI failures are reproducible

      // Generate original sample
      generator1.sample(10)
      const state = generator1.save()
      const values1 = generator1.sample(10)

      // Generate new instance from saved state
      const generator2 = dist[tc.name].load(state)
      const values2 = generator2.sample(10)

      // Both generators must produce identical sequences from the same restored state
      assert(values2.every((d, i) => d === values1[i]))
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
    // per-distribution override for GoF assertion only; support-range check in .sample() always uses SAMPLE_SIZE
    // See solutions/testing/2026-05-22-1820-per-distribution-gof-sample-size-override.md
    const n = tc.sampleSize

    // Go through text cases.
    cases.forEach(c => {
      describe(c.name, () => {
        it('should pass for own test', () => {
          for (const s of (tc.testSeeds ?? [0, 42, 12345])) {
            const generator = c.gen()
            generator.seed(s)
            assert(generator.test(generator.sample(n ?? SAMPLE_SIZE)).passed, `seed ${s}`)
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
  },

  // See solutions/testing/2026-06-07-1748-data-driven-fit-moment-test-configs.md
  // Data-driven moment checks. tc.moments is an array of entries, each with positional
  // `params` and any of `mean`/`variance`/`skewness`/`kurtosis` (finite, NaN, or ±Infinity).
  // `tol` is either a single number applied to every moment, or a per-moment object
  // `{ mean, variance, skewness, kurtosis }` (each defaulting to 1e-12) so a tight check on
  // the mean is not relaxed to the kurtosis tolerance. No-op when tc.moments is absent.
  moments (tc) {
    if (!tc.moments) {
      return
    }
    tc.moments.forEach(m => {
      const label = m.name || `${tc.name}(${m.params.join(', ')})`
      it(`${label} moments should match analytical values`, () => {
        const d = new dist[tc.name](...m.params)
        const tolOf = key => (m.tol !== null && typeof m.tol === 'object' ? m.tol[key] : m.tol) ?? 1e-12
        checkMoment(`${label} mean`, () => d.mean(), m.mean, tolOf('mean'))
        checkMoment(`${label} variance`, () => d.variance(), m.variance, tolOf('variance'))
        checkMoment(`${label} skewness`, () => d.skewness(), m.skewness, tolOf('skewness'))
        checkMoment(`${label} kurtosis`, () => d.kurtosis(), m.kurtosis, tolOf('kurtosis'))
      })
    })
  },

  // Data-driven fit check. tc.fit may be a single spec object or an array of specs.
  // Spec fields:
  //   params, seed, n         — sample n points from planted params; mutually exclusive with data
  //   data                    — literal array to fit instead of sampling
  //   tolerances              — { [paramName]: tol } max absolute deviation from planted param
  //   exact                   — [paramName, ...] params that must match planted exactly
  //   usableAt                — x: asserts pdf(x) is finite and positive after fit
  //   fitCheck                — [{ at, fn, value, tol }] asserts |result[fn](at) - value| < tol
  // No-op when tc.fit is absent.
  fit (tc) {
    if (!tc.fit) {
      return
    }
    const specs = Array.isArray(tc.fit) ? tc.fit : [tc.fit]
    specs.forEach((spec, i) => {
      const label = specs.length > 1
        ? `${tc.name}.fit[${i}] should recover planted parameters`
        : `${tc.name}.fit should recover planted parameters`
      it(label, () => assertFitSpec(tc, spec))
    })
  }
}

// Runs all assertions for one fit spec; extracted from UnitTests.fit to reduce cyclomatic complexity.
function assertParamRecovery (tc, result, planted, { tolerances, exact }) {
  if (!planted) {
    return
  }
  if (tolerances) {
    Object.entries(tolerances).forEach(([name, tol]) => {
      assert(Math.abs(result.p[name] - planted.p[name]) < tol,
        `${tc.name}.fit ${name} = ${result.p[name]}, expected ≈ ${planted.p[name]} (tol ${tol})`)
    })
  }
  if (exact) {
    exact.forEach(name => {
      assert.strictEqual(result.p[name], planted.p[name],
        `${tc.name}.fit ${name} = ${result.p[name]}, expected exactly ${planted.p[name]}`)
    })
  }
}

function assertFitSpec (tc, spec) {
  const { params, seed, n, data: fixedData, usableAt, fitCheck } = spec
  const data = fixedData != null ? fixedData : new dist[tc.name](...params).seed(seed).sample(n)
  const planted = params != null ? new dist[tc.name](...params) : null
  const result = dist[tc.name].fit(data)
  // Always verify fit returns the right type; tolerances/exact/usableAt/fitCheck add
  // further assertions. An entry with none of them (heuristic-MOM fits where recovery
  // is not reliable) intentionally asserts only the instance type.
  assert(result instanceof dist[tc.name])
  assertParamRecovery(tc, result, planted, spec)
  if (usableAt !== undefined) {
    assert(Number.isFinite(result.pdf(usableAt)) && result.pdf(usableAt) > 0,
      `${tc.name}.fit pdf(${usableAt}) = ${result.pdf(usableAt)}, expected finite and positive`)
  }
  if (fitCheck) {
    fitCheck.forEach(({ at, fn, value, tol }) => {
      assert(Math.abs(result[fn](at) - value) < tol,
        `${tc.name}.fit ${fn}(${at}) = ${result[fn](at)}, expected ≈ ${value} (tol ${tol})`)
    })
  }
}

// Assert a single moment value, handling finite (relative-free absolute tol), NaN, and ±Infinity.
// `getActual` is a thunk so a divergent computation is only invoked when an expected value is given.
function checkMoment (label, getActual, expected, tol) {
  if (expected === undefined) {
    return
  }
  const actual = getActual()
  if (Number.isNaN(expected)) {
    assert(Number.isNaN(actual), `${label} = ${actual}, expected NaN`)
  } else if (!Number.isFinite(expected)) {
    assert(actual === expected, `${label} = ${actual}, expected ${expected}`)
  } else {
    assert(Math.abs(actual - expected) < tol, `${label} = ${actual}, expected ${expected} (tol ${tol})`)
  }
}

/**
 * Registers the full per-distribution test tree (constructor, seed, load/save,
 * analytical properties, sampling, GoF test, moments, fit) for each case in
 * `testCases`. Shared by the shard files so each mocha --parallel worker
 * registers the same describe/it structure for its own slice of cases.
 *
 * @param {Array} testCases Distribution test case definitions (see dist-cases-*.js).
 */
export function registerDistributionTests (testCases) {
  testCases
    // .filter(tc => ['Rice'].indexOf(tc.name) > -1)
    .forEach(tc => {
      describe(tc.name, () => {
        describe('constructor', () => UnitTests.constructor(tc))
        describe('.seed()', () => UnitTests.seed(tc))
        describe('static .load(), .save()', () => UnitTests.loadAndSave(tc))
        describe('.pdf(), .cdf(), .q()', () => UnitTests.analytical(tc))
        describe('.sample()', () => UnitTests.sample(tc))
        describe('.test()', () => UnitTests.test(tc))
        describe('.mean(), .variance(), .skewness(), .kurtosis()', () => UnitTests.moments(tc))
        describe('.fit()', () => UnitTests.fit(tc))
      })
    })
}
