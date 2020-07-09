import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, trials, ksTest, chiTest, Tests } from './test-utils'
import { float } from '../src/core'
import * as dist from '../src/dist'
import InvalidDiscrete from '../src/dist/_invalid'
import PreComputed from '../src/dist/_pre-computed'
import testCases from './dist-cases'
import Distribution from '../src/dist/_distribution'

// Constants
const LAPS = 1000
// TODO Decrease sample size.
const LAPS_2 = 1000

const UnitTests = {
  constructor (tc) {
    it('should throw error if params are invalid', () => {
      tc.invalidParams.forEach(params => {
        assert.throws(() => new dist[tc.name](...params))
      })
    })
  },

  seed (tc) {
    it('should give the same sample for the same seed', () => {
      trials(() => {
        const self = new dist[tc.name]()
        const s = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
        self.seed(s)
        const values1 = self.sample(LAPS_2)
        self.seed(s)
        const values2 = self.sample(LAPS_2)
        return values1.reduce((acc, d, i) => acc && d === values2[i], true)
      })
    })

    it('should give different samples for different seeds', () => {
      trials(() => {
        const self = new dist[tc.name]()
        self.seed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
        const values1 = self.sample(LAPS_2)
        self.seed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
        const values2 = self.sample(LAPS_2)
        return values1.reduce((acc, d, i) => acc || d !== values2[i], true)
      })
    })
  },

  loadAndSave (tc) {
    it('loaded state should continue where it was saved at', () => {
      trials(() => {
        // Create generator and seed
        const generator = new dist[tc.name]()
        const s = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
        const cut = LAPS_2 / 3

        // Generate full sample
        const values = generator.sample(LAPS_2)

        // Reset generator, create two sub samples
        generator.seed(s)
        const values1 = generator.sample(cut)
        let state = generator.save()
        generator.seed(0)
        generator.load(state)
        const values2 = generator.sample(LAPS_2 - cut)

        // Compare samples
        return values1.concat(values2)
          .reduce((acc, d, i) => acc || d === values[i], true)
      })
    })

    it('loaded state should copy full state of generator', () => {
      trials(() => {
        // Create seeded generator
        const generator1 = new dist[tc.name]()
        generator1.seed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

        // Generate original sample
        generator1.sample(LAPS_2)
        const state = generator1.save()
        const values1 = generator1.sample(LAPS_2)

        // Generate new default generator and load state
        const generator2 = new dist[tc.name]().load(state)
        const values2 = generator2.sample(LAPS_2)

        // Compare samples
        return values1.reduce((acc, d, i) => acc || d !== values2[i], true)
      })
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
          trials(() => Tests.pdfType(c.gen(), LAPS_2))
        })
        it('pdf should be non-negative', () => {
          trials(() => Tests.pdfRange(c.gen(), LAPS_2))
        })
        it('cdf should return valid numbers', () => {
          trials(() => Tests.cdfType(c.gen(), LAPS_2))
        })
        it('cdf should be in [0, 1]', () => {
          trials(() => Tests.cdfRange(c.gen(), LAPS_2))
        })
        it('cdf should be non-decreasing', () => {
          trials(() => Tests.cdfMonotonicity(c.gen(), LAPS_2))
        })
        it('pdf (pmf) should be the differential (difference) of cdf', () => {
          trials(() => Tests.pdf2cdf(c.gen(), LAPS_2))
        })
        // Quantile tests use only 10% of the normal sample size due to computational complexity.
        it('quantile should return valid numbers', () => {
          trials(() => Tests.qType(c.gen(), LAPS_2 / 10))
        })
        it('quantile should be within support', () => {
          trials(() => Tests.qRange(c.gen(), LAPS_2 / 10))
        })
        it('quantile should be non-decreasing', () => {
          trials(() => Tests.qMonotonicity(c.gen(), LAPS_2 / 10))
        })
        it('quantile should satisfy Galois intequalities', () => {
          trials(() => Tests.qGalois(c.gen(), LAPS_2 / 10))
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
        it('sample should contain valid numbers', () => {
          trials(() => {
            const sample = c.gen().sample(LAPS_2)
            return sample.reduce((acc, d) => acc && Number.isFinite(d) && !isNaN(d), true)
          })
        })

        it('sample should be within the range of the support', () => {
          trials(() => {
            const generator = c.gen()
            const supp = generator.support()
            const sample = generator.sample(LAPS_2)
            return sample.reduce((acc, d) => {
              let above = d >= supp[0].value
              let below = d <= supp[1].value
              return acc && above && below
            }, true)
          })
        })

        it('sample values should be distributed correctly', () => {
          trials(() => {
            const generator = c.gen()
            return generator.type() === 'continuous'
              ? ksTest(generator.sample(LAPS_2), x => generator.cdf(x))
              : chiTest(generator.sample(LAPS_2), x => generator.pdf(x),
                Object.keys(generator.save().params).length)
          })
        })
      })
    })
  },

  test (tc) {
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
        it('should pass for own test', () => {
          trials(() => {
            const generator = c.gen()
            return generator.test(generator.sample(LAPS_2)).passed
          })
        })

        it('should reject foreign distribution', () => {
          trials(() => {
            const generator = c.gen()
            const sample = generator.sample(LAPS_2)
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
    const invalid = new InvalidDiscrete()

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
  testCases.forEach(tc  => {
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
