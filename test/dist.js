import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, trials, ksTest, chiTest, Tests } from './test-utils'
import { float } from '../src/core'
import * as dist from '../src/dist'
import PreComputed from '../src/dist/_pre-computed'
import testCases from './dist-cases'
import Distribution from '../src/dist/_distribution'


// Constants.
const PRECISION = 1e-10
const LAPS = 1000
const SAMPLE_SIZE = 1000


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
      const self = new dist[tc.name]()
      const s = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
      self.seed(s)
      const values1 = self.sample(sampleSize)
      self.seed(s)
      const values2 = self.sample(sampleSize)
      assert(values1.reduce((acc, d, i) => acc && Math.abs(d - values2[i]) < PRECISION, true))
    })

    it('should give different samples for different seeds', () => {
      const self = new dist[tc.name]()
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
        const generator = new dist[tc.name]()
        const s = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
        const cut = Math.floor(sampleSize / 3)

        // Generate full sample
        const values = generator.sample(sampleSize)

        // Reset generator, create two sub samples
        generator.seed(s)
        const values1 = generator.sample(cut)
        let state = generator.save()
        generator.seed(0)
        generator.load(state)
        const values2 = generator.sample(sampleSize - cut)

        // Compare samples
        assert(values1.concat(values2).reduce((acc, d, i) => acc || d === values[i], true))
      })

    it('loaded state should copy full state of generator', () => {
        // Create seeded generator
        const generator1 = new dist[tc.name]()
        generator1.seed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

        // Generate original sample
        generator1.sample(LAPS)
        const state = generator1.save()
        const values1 = generator1.sample(LAPS)

        // Generate new default generator and load state
        const generator2 = new dist[tc.name]().load(state)
        const values2 = generator2.sample(LAPS)

        // Compare samples
        assert(values1.reduce((acc, d, i) => acc || d !== values2[i], true) === true)
      })
  },

  pdf (tc) {
    // Test cases
    let cases = [{
      name: 'default parameters',
      gen: () => new dist[tc.name]()
    }].concat(tc.cases.map(c => ({
      name: c.name || 'random parameters',
      gen: () => new dist[tc.name](...c.params())
    })))

    cases.forEach(c => {
      describe(c.name, () => {
        it('pdf should return valid numbers', () => {
          assert(Tests.pdfType(c.gen(), 100))
        })

        it('pdf should be non-negative', () => {
          assert(Tests.pdfRange(c.gen(), 100))
        })

        it('cdf should return valid numbers', () => {
          assert(Tests.cdfType(c.gen(), 100))
        })

        it('cdf should be in [0, 1]', () => {
          assert(Tests.cdfRange(c.gen(), 100))
        })

        it('cdf should be non-decreasing', () => {
          assert(Tests.cdfMonotonicity(c.gen(), 100))
        })

        it('pdf (pmf) should be the differential (difference) of cdf', () => {
          assert(Tests.pdf2cdf(c.gen(), 100))
        })

        it('quantile should return valid numbers', () => {
          assert(Tests.qType(c.gen(), 100))
        })

        it('quantile should be within support', () => {
          assert(Tests.qRange(c.gen(), 100))
        })

        it('quantile should be non-decreasing', () => {
          assert(Tests.qMonotonicity(c.gen(), 100))
        })

        it('quantile should satisfy Galois inequalities', () => {
          assert(Tests.qGalois(c.gen(), 100))
        })
      })
    })
  },

  sample (tc) {
    // Test cases
    let cases = [{
      name: 'default parameters',
      gen: () => new dist[tc.name]()
    }].concat(tc.cases.map(c => ({
      name: c.name || 'random parameters',
      gen: () => new dist[tc.name](...c.params())
    })))

    cases.forEach(c => {
      describe(c.name, () => {
        it('sample should be within the range of the support', () => {
          // Generate sample.
          const generator = c.gen()
          const supp = generator.support()
          const sample = generator.sample(SAMPLE_SIZE)

          // Check if all values are numbers.
          assert(sample.reduce((acc, d) => acc && Number.isFinite(d) && !isNaN(d), true), 'Sample contains invalid values')

          // Check if values are within range.
          assert(sample.reduce((acc, d) => {
            let above = d >= supp[0].value
            let below = d <= supp[1].value
            return acc && above && below
          }, true), 'Sample is out of range')
        })

        it('sample values should be distributed correctly', () => {
          trials(() => {
            const generator = c.gen()
            return generator.type() === 'continuous'
              ? ksTest(generator.sample(SAMPLE_SIZE), x => generator.cdf(x))
              : chiTest(generator.sample(SAMPLE_SIZE), x => generator.pdf(x),
                Object.keys(generator.save().params).length)
          })
        })
      })
    })
  },

  test (tc) {
    // Test cases.
    let cases = [{
      name: 'default parameters',
      gen: () => new dist[tc.name]()
    }].concat(tc.cases.map(c => ({
      name: c.name || 'random parameters',
      gen: () => new dist[tc.name](...c.params())
    })))

    // Go through text cases.
    cases.forEach(c => {
      describe(c.name, () => {
        it('should pass for own test', () => {
          trials(() => {
            const generator = c.gen()
            return generator.test(generator.sample(SAMPLE_SIZE)).passed
          })
        })

        it('should reject foreign distribution', () => {
          trials(() => {
            const generator = c.gen()
            const sample = generator.sample(SAMPLE_SIZE)
            return !(new dist[tc.foreign.generator](...tc.foreign.params(sample))).test(sample).passed
          })
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
  });

  describe('PreComputed', () => {
    class PreComputedTestClass extends PreComputed {
      constructor () {
        super()
      }
    }
    const preComputed = new PreComputedTestClass()

    it('should throw error if _pk is not overridden', () => {
      assert.throws(() => {
        preComputed._pk()
      }, 'PreComputed._pk() is not implemented')
    })
  })

  // Ordinary distributions.
  testCases
    //.filter(tc => ['Kolmogorov'].indexOf(tc.name) > -1)
    .forEach(tc  => {
      describe(tc.name, () => {
        describe('constructor', () => UnitTests.constructor(tc))
        describe('.seed()', () => UnitTests.seed(tc))
        describe('.load(), .save()', () => UnitTests.loadAndSave(tc))
        describe('.pdf(), .cdf(), .q()', () => UnitTests.pdf(tc))
        describe('.sample()', () => UnitTests.sample(tc))
        describe('.test()', () => UnitTests.test(tc))
      })
    })

  // Degenerate distribution
  describe('Degenerate', () => {
    const p = () => [float(-10, 10)]
    describe('.sample()', () => {
      it('should generate values with Degenerate distribution', () => {
        trials(() => {
          const x0 = p()
          let degenerate = new dist.Degenerate(...x0)
          const samples = degenerate.sample(LAPS)
          return samples.reduce((s, d) => s && d === x0[0], true)
        })

        trials(() => {
          let degenerate = new dist.Degenerate()
          const samples = degenerate.sample(LAPS)
          return samples.reduce((s, d) => s && d === 0, true)
        })
      })
    })

    describe('.pdf(), .cdf()', () => {
      it('differentiating cdf should give pdf', () => {
        repeat(() => {
          const x0 = p()
          let degenerate = new dist.Degenerate(...x0)
          assert.equal(degenerate.pdf(x0[0]), 1)
          assert.equal(degenerate.pdf(x0[0] + Math.random() * 2 - 1), 0)
          assert.equal(degenerate.cdf(x0[0] - Math.random()), 0)
          assert.equal(degenerate.cdf(x0[0]), 1)
          assert.equal(degenerate.cdf(x0[0] + Math.random()), 1)
        }, LAPS)
      })
    })
  })
})
