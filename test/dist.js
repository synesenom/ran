import { assert } from 'chai'
import { describe, it } from 'mocha'
import utils from './test-utils'
import { float, int } from '../src/core'
import * as dist from '../src/dist'
import InvalidDiscrete from '../src/dist/_invalid'
import testCases from './dist-cases'


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
      utils.trials(() => {
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
      utils.trials(() => {
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
      utils.trials(() => {
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
      utils.trials(() => {
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
          utils.trials(() => utils.Tests.pdfType(c.gen(), LAPS_2))
        })
        it('pdf should be non-negative', () => {
          utils.trials(() => utils.Tests.pdfRange(c.gen(), LAPS_2))
        })
        it('cdf should return valid numbers', () => {
          utils.trials(() => utils.Tests.cdfType(c.gen(), LAPS_2))
        })
        it('cdf should be in [0, 1]', () => {
          utils.trials(() => utils.Tests.cdfRange(c.gen(), LAPS_2))
        })
        it('cdf should be non-decreasing', () => {
          utils.trials(() => utils.Tests.cdfMonotonicity(c.gen(), LAPS_2))
        })
        it('pdf (pmf) should be the differential (difference) of cdf', () => {
          utils.trials(() => utils.Tests.pdf2cdf(c.gen(), LAPS_2))
        })
        // Quantile tests use only 10% of the normal sample size due to computational complexity.
        it('quantile should return valid numbers', () => {
          utils.trials(() => utils.Tests.qType(c.gen(), LAPS_2 / 10))
        })
        it('quantile should be within support', () => {
          utils.trials(() => utils.Tests.qRange(c.gen(), LAPS_2 / 10))
        })
        it('quantile should be non-decreasing', () => {
          utils.trials(() => utils.Tests.qMonotonicity(c.gen(), LAPS_2 / 10))
        })
        it('quantile should satisfy Galois intequalities', () => {
          utils.trials(() => utils.Tests.qGalois(c.gen(), LAPS_2 / 10))
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
          utils.trials(() => {
            const sample = c.gen().sample(LAPS_2)
            return sample.reduce((acc, d) => acc && Number.isFinite(d) && isFinite(d) && !isNaN(d), true)
          })
        })

        it('sample should be within the range of the support', () => {
          utils.trials(() => {
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
          utils.trials(() => {
            const generator = c.gen()
            return generator.type() === 'continuous'
              ? utils.ksTest(generator.sample(LAPS_2), x => generator.cdf(x))
              : utils.chiTest(generator.sample(LAPS_2), x => generator.pdf(x),
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
          utils.trials(() => {
            const generator = c.gen()
            return generator.test(generator.sample(LAPS_2)).passed
          })
        })

        it('should reject foreign distribution', () => {
          utils.trials(() => {
            const generator = c.gen()
            const sample = generator.sample(LAPS_2)
            return !(new dist[tc.foreign.generator](...tc.foreign.params(sample))).test(sample).passed
          })
        })
      })
    })
  }
}

function utConstructor (name, invalidParams) {
  it('should throw error if params are invalid', () => {
    invalidParams.forEach(p => {
      assert.throws(() => new dist[name](...p))
    })
  })
}

function utSample (name, params, skip) {
  it('sample should contain valid numbers', () => {
    utils.trials(() => {
      const sample = new dist[name](...params()).sample(1000)
      return sample.reduce((acc, d) => acc && Number.isFinite(d) && isFinite(d) && !isNaN(d), true)
    })
  })

  it('sample should be within the range of the support', () => {
    utils.trials(() => {
      const self = new dist[name](...params())
      const supp = self.support()
      const sample = self.sample(1000)
      return sample.reduce((acc, d) => {
        let above = d >= supp[0].value
        let below = d <= supp[1].value
        return acc && above && below
      }, true)
    })
  })

  it('values should be distributed correctly with default parameters', () => {
    utils.trials(() => {
      const self = new dist[name]()
      return self.type() === 'continuous'
        ? utils.ksTest(self.sample(LAPS), x => self.cdf(x))
        : utils.chiTest(self.sample(LAPS), x => self.pdf(x), params().length)
    })
  })

  if (!skip || skip.indexOf('test-self') === -1) {
    it('values should be distributed correctly with random parameters', () => {
      utils.trials(() => {
        const self = new dist[name](...params())
        return self.type() === 'continuous'
          ? utils.ksTest(self.sample(LAPS), x => self.cdf(x))
          : utils.chiTest(self.sample(LAPS), x => self.pdf(x), params().length)
      })
    })
  }
}

function utSeed (name, params) {
  it('should give the same sample for the same seed', () => {
    utils.trials(() => {
      const self = new dist[name](...params())
      const s = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
      self.seed(s)
      const values1 = self.sample(LAPS)
      self.seed(s)
      const values2 = self.sample(LAPS)
      return values1.reduce((acc, d, i) => acc && d === values2[i], true)
    })
  })

  it('should not give the same sample for different seeds', () => {
    utils.trials(() => {
      const self = new dist[name](...params())
      self.seed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
      const values1 = self.sample(LAPS)
      self.seed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
      const values2 = self.sample(LAPS)
      return values1.reduce((acc, d, i) => acc || d !== values2[i], true)
    })
  })
}

function utLoadSave (name, params) {
  it('loaded state should continue where it was saved at', () => {
    utils.trials(() => {
      // Create generator and seed
      const self = new dist[name](...params())
      const s = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
      const cut = LAPS / 3

      // Generate full sample
      const values = self.sample(LAPS)

      // Reset generator, create two sub samples
      self.seed(s)
      const values1 = self.sample(cut)
      let state = self.save()
      self.seed(0)
      self.load(state)
      const values2 = self.sample(LAPS - cut)

      // Compare samples
      return values1.concat(values2)
        .reduce((acc, d, i) => acc || d === values[i], true)
    })
  })

  it('loaded state should copy full state of generator', () => {
    utils.trials(() => {
      // Create seeded generator
      const self1 = new dist[name](...params())
      self1.seed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

      // Generate original sample
      self1.sample(LAPS)
      const state = self1.save()
      const values1 = self1.sample(LAPS)

      // Generate new default generator and load state
      const self2 = new dist[name]().load(state)
      const values2 = self2.sample(LAPS)

      // Compare samples
      return values1.reduce((acc, d, i) => acc || d !== values2[i], true)
    })
  })
}

function utPdf (name, params) {
  it('pdf should return valid numbers', () => {
    utils.trials(() => utils.Tests.pdfType(new dist[name](...params()), LAPS))
  })

  it('pdf should be non-negative', () => {
    utils.trials(() => utils.Tests.pdfRange(new dist[name](...params()), LAPS))
  })

  it('cdf should return valid numbers', () => {
    utils.trials(() => utils.Tests.cdfType(new dist[name](...params()), LAPS))
  })

  it('cdf should be in [0, 1]', () => {
    utils.trials(() => utils.Tests.cdfRange(new dist[name](...params()), LAPS))
  })

  it('cdf should be non-decreasing', () => {
    utils.trials(() => utils.Tests.cdfMonotonicity(new dist[name](...params()), LAPS))
  })

  it('pdf (pmf) should be the differential (difference) of cdf', () => {
    utils.trials(() => utils.Tests.pdf2cdf(new dist[name](...params()), LAPS), 8)
  })

  it('quantile should return valid numbers', () => {
    utils.trials(() => utils.Tests.qType(new dist[name](...params()), LAPS / 10))
  })

  it('quantile should be within support', () => {
    utils.trials(() => utils.Tests.qRange(new dist[name](...params()), LAPS / 10))
  })

  it('quantile should be non-decreasing', () => {
    utils.trials(() => utils.Tests.qMonotonicity(new dist[name](...params()), LAPS / 10))
  })

  it('quantile should satisfy Galois intequalities', () => {
    utils.trials(() => utils.Tests.qGalois(new dist[name](...params()), LAPS / 10))
  })
}

function utTest (name, params, type = 'self') {
  switch (type) {
    case 'self':
      utils.trials(() => {
        const self = new dist[name](...params())
        return self.test(self.sample(LAPS)).passed
      })
      break

    case 'foreign':
      utils.trials(() => {
        const self = new dist[name](...params())

        const sample = self.sample(LAPS)
        const foreign = self.type() === 'continuous'
          ? new dist.Uniform(Math.min(...sample), Math.max(...sample))
          : new dist.DiscreteUniform(Math.min(...sample) - 1, Math.max(...sample) + 1)
        return !foreign.test(sample).passed
      })
      break
  }
}

const Param = {
  rangeMin () {
    return float(0.1, 10)
  },

  rangeIn () {
    return float(10, 20)
  },

  rangeMax () {
    return float(20, 30)
  },

  shape () {
    return float(0.1, 5)
  },

  location () {
    return float(-5, 5)
  },

  scale () {
    return float(0.1, 5)
  },

  prob () {
    return float(0.01, 0.99)
  },

  count () {
    return int(3, 20)
  },

  degree () {
    return int(1, 10)
  },

  rate () {
    return float(0.1, 10)
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

  // Ordinary distributions
  [/*, {
    name: 'BetaGeometric',
    p: () => [Param.shape(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // alpha > 0
      [1, -1], [1, 0]   // beta > 0
    ]
  }*//*, {
    name: 'BetaNegativeBinomial',
    p: () => [Param.degree(), Param.shape(), Param.shape()],
    pi: [
      [-1, 1, 1], [0, 1, 1],    // r > 0
      [10, -1, 1], [10, 0, 1],  // alpha > 0
      [10, 1, -1], [10, 1, 0]   // beta > 0
    ]
  }*/{
    name: 'Laplace',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0] // b > 0
    ]
  }, {
    name: 'Levy',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0] // c > 0
    ]
  }, {
    name: 'Lindley',
    p: () => [Param.shape()],
    pi: [
      [-1], [0] // theta > 0
    ]
  }, {
    name: 'LogCauchy',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0]  // sigma > 0
    ]
  }, {
    name: 'LogGamma',
    p: () => [Param.shape(), Param.rate(), Param.shape()],
    pi: [
      [-1, 1, 0], [0, 1, 0],  // alpha > 0
      [1, -1, 0], [1, 0, 0],  // beta > 0
      [1, 1, -1]              // mu >= 0
    ]
  }, {
    name: 'LogLaplace',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0] // b > 0
    ]
  }, {
    name: 'LogLogistic',
    p: () => [Param.scale(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // alpha > 0
      [1, -1], [1, 0]   // beta > 0
    ]
  }, {
    name: 'LogNormal',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0] // sigma > 0
    ]
  }, {
    name: 'LogSeries',
    p: () => [Param.prob()],
    pi: [
      [-1], [0], [1], [2] // 0 < p < 1
    ]
  }, {
    name: 'Logarithmic',
    p: () => [Param.rangeMin() + 1, Param.rangeMax() + 5],
    pi: [
      [-1, 2], [0, 2],  // a >= 1
      [1, -1], [1, 0],  // b >= 1
      [2, 2], [3, 2]    // a < b
    ]
  }, {
    name: 'Logistic',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0] // s > 0
    ]
  }, {
    name: 'LogisticExponential',
    p: () => [Param.scale(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // lambda > 0
      [1, -1], [1, 0]   // kappa > 0
    ]
  }, {
    name: 'LogitNormal',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0] // sigma > 0
    ]
  }, {
    name: 'Lomax',
    p: () => [Param.scale(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // lambda > 0
      [1, -1], [1, 0]   // alpha > 0
    ]
  }, {
    name: 'Makeham',
    p: () => [Param.shape(), Param.rate(), Param.scale()],
    pi: [
      [-1, 1, 1], [0, 1, 1],  // alpha > 0
      [1, -1, 1], [1, 0, 1],  // beta > 0
      [1, 1, -1], [1, 1, 0]   // lambda > 0
    ]
  }, {
    name: 'MaxwellBoltzmann',
    p: () => [Param.scale()],
    pi: [
      [-1], [0] // a > 0
    ]
  }, {
    name: 'Mielke',
    p: () => [Param.shape(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // k > 0
      [2, -1], [2, 0]   // s > 0
    ]
  }, {
    name: 'Moyal',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0] // sigma > 0
    ]
  }, {
    name: 'Muth',
    p: () => [Param.prob()],
    pi: [
      [-1], [0], [2]  // 0 < alpha <= 1
    ]
  }, {
    name: 'Nakagami',
    p: () => [Param.shape() + 0.5, Param.scale()],
    pi: [
      [-1, 1], [0, 1], [0.3, 1],  // m >= 0.5
      [1, -1], [1, 0]             // omega > 0
    ]
  }, {
    name: 'NegativeHypergeometric',
    p: () => [int(30, 40), int(10, 20), int(5, 10)],
    pi: [
      [-1, 5, 5],               // N >= 0
      [10, -1, 5], [10, 11, 5], // 0 <= K <= N
      [10, 5, -1], [10, 5, 6]   // 0 <= r <= K - N
    ]
  }, {
    name: 'NegativeBinomial',
    p: () => [Param.count(), Param.prob()],
    pi: [
      [-1, 0.5], [0, 0.5],                // r > 0
      [10, -1], [10, 0], [10, 1], [10, 2] // 0 < p < 1
    ]
  }, {
    name: 'NeymanA',
    p: () => [Param.shape(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // lambda > 0
      [1, -1], [1, 0]   // mu > 0
    ]
  }, {
    name: 'NoncentralBeta',
    p: () => [Param.shape(), Param.shape(), Param.scale()],
    pi: [
      [-1, 2, 1], [0, 2, 1],  // alpha > 0
      [2, -1, 1], [2, 0, 1],  // beta > 0
      [2, 2, -1]              // lambda >= 0
    ]
  }, {
    name: 'NoncentralChi2',
    p: () => [Param.degree(), Param.scale()],
    pi: [
      [-1, 1], [0, 1],  // k > 0
      [2, -1], [2, 0]   // lambda > 0
    ]
  }, {
    name: 'NoncentralChi',
    p: () => [4, 4],
    pi: [
      [-1, 1], [0, 1],  // k > 0
      [2, -1], [2, 0]   // lambda > 0
    ]
  }, {
    name: 'NoncentralF',
    p: () => [Param.degree(), Param.degree(), Param.scale()],
    pi: [
      [-1, 2, 1], [0, 2, 1],  // alpha > 0
      [2, -1, 1], [2, 0, 1],  // beta > 0
      [2, 2, -1]              // lambda >= 0
    ]
  }, {
    name: 'NoncentralT',
    p: () => [Param.degree(), Param.location()],
    pi: [
      [-1, 1], [0, 1] // nu > 0
    ]
  }, {
    name: 'Normal',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0] // sigma > 0
    ]
  }, {
    name: 'Pareto',
    p: () => [Param.scale(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // xmin > 0
      [1, -1], [1, 0]   // alpha > 0
    ]
  }, {
    name: 'PERT',
    p: () => [Param.rangeMin(), Param.rangeIn(), Param.rangeMax()],
    pi: [
      [0.5, 0.5, 1], [0.8, 0.5, 1], // a < b
      [0, 1, 1], [0, 1.1, 1]        // b < c
    ]
  }, {
    name: 'Poisson',
    cases: [{
      desc: 'low mean',
      p: () => [float(20)],
      pi: [
        [-1], [0] // lambda > 0
      ]
    }, {
      desc: 'high mean',
      p: () => [float(31, 50)]
    }]
  }, {
    name: 'PolyaAeppli',
    p: () => [Param.shape(), Param.prob()],
    pi: [
      [-1, 0.5], [0, 0.5],            // lambda > 0
      [1, -1], [1, 0], [1, 1], [1, 2] // 0 < theta < 1
    ]
  }, {
    name: 'Power',
    p: () => [Param.scale()],
    pi: [
      [-1], [0] // a > 0
    ]
  }, {
    name: 'QExponential',
    p: () => [2 - Param.shape(), Param.rate()],
    pi: [
      [2, 1], [3, 1],     // q < 2
      [1.5, -1], [1.5, 0] // lambda > 0
    ]
  }, {
    name: 'R',
    p: () => [Param.shape()],
    pi: [
      [-1], [0] // c > 0
    ]
  }, {
    name: 'Rademacher',
    p: () => []
  }, {
    name: 'RaisedCosine',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0] // s > 0
    ]
  }, {
    name: 'Rayleigh',
    p: () => [Param.scale()],
    pi: [
      [-1], [0] // sigma > 0
    ]
  }, {
    name: 'Reciprocal',
    p: () => [Param.rangeMin(), Param.rangeMax()],
    pi: [
      [-1, 2], [0, 2],  // a > 0
      [1, -1], [1, 0],  // b > 0
      [2, 2], [3, 2]    // a < b
    ]
  }, {
    name: 'ReciprocalInverseGaussian',
    p: () => [Param.scale(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // mu > 0
      [1, -1], [1, 0]   // lambda > 0
    ]
  }, {
    name: 'Rice',
    p: () => [Param.shape(), Param.scale()],
    pi: [
      [-1, 1], [0, 1],  // nu > 0
      [1, -1], [1, 0]   // sigma > 0
    ]
  }, {
    name: 'ShiftedLogLogistic',
    cases: [{
      desc: 'positive shape parameter',
      p: () => [Param.location(), Param.scale(), float(0.1, 5)],
      pi: [
        [0, -1, 1], [0, 0, 1] // sigma > 0
      ]
    }, {
      desc: 'negative shape parameter',
      p: () => [Param.location(), Param.scale(), float(-5, -0.1)]
    }, {
      desc: 'zero shape parameter',
      p: () => [Param.location(), Param.scale(), 0]
    }]
  }, {
    name: 'Skellam',
    p: () => [float(1, 10), float(1, 10)],
    pi: [
      [-1, 1], [0, 1],  // mu1 > 0
      [1, -1], [1, 0]   // mu2 > 0
    ]
  }, {
    name: 'SkewNormal',
    cases: [{
      desc: 'positive shape parameter',
      p: () => [Param.location(), Param.scale(), Param.shape()],
      pi: [
        [0, 1, -1], [0, 1, 0] // omega > 0
      ]
    }, {
      desc: 'negative shape parameter',
      p: () => [Param.location(), Param.scale(), -Param.shape()]
    }, {
      desc: 'zero shape parameter',
      p: () => [Param.location(), Param.scale(), 0]
    }]
  }, {
    name: 'Slash',
    p: () => []
  }, {
    name: 'Soliton',
    p: () => [Param.count()],
    pi: [
      [-1], [0] // N > 0
    ]
  }, {
    name: 'StudentT',
    p: () => [Param.shape()],
    pi: [
      [-1], [0] // nu > 0
    ]
  }, {
    name: 'StudentZ',
    p: () => [Param.shape() + 1],
    pi: [
      [-1], [0], [1]  // n > 1
    ]
  }, {
    name: 'Trapezoidal',
    p: () => [Param.location(), Param.location(), Param.location(), Param.location()].sort((a, b) => a - b),
    pi: [
      [1, 0.33, 0.67, 1], [2, 0.33, 0.67, 1],                     // a < d
      [1, 0.33, 0.67, 1], [0, 0.67, 0.67, 1], [0, 0.8, 0.67, 1],  // a <= b < c
      [0, 0.33, 2, 1]                                             // c <= d
    ],
    skip: ['test-foreign']
  }, {
    name: 'Triangular',
    p: () => [Param.rangeMin(), Param.rangeMax(), Param.rangeIn()],
    pi: [
      [1, 1, 0.5], [2, 1, 0.5], // a < b
      [0, 1, -1], [0, 1, 2]     // a <= c <= b
    ]
  }, {
    name: 'TukeyLambda',
    cases: [{
      desc: 'zero shape parameter',
      p: () => [0]
    }, {
      desc: 'positive shape parameter',
      p: () => [Param.shape()],
      skip: ['test-foreign']
    }, {
      desc: 'negative shape parameter',
      p: () => [-Param.shape()]
    }]
  }, {
    name: 'UQuadratic',
    p: () => [Param.rangeMin(), Param.rangeMax()],
    pi: [
      [1, 1], [2, 1]  // a < b
    ]
  }, {
    name: 'Uniform',
    p: () => [Param.rangeMin(), Param.rangeMax()],
    pi: [
      [1, 1], [2, 1]  // a < b
    ],
    skip: ['test-foreign']
  }, {
    name: 'UniformProduct',
    p: () => [Param.degree() + 1],
    pi: [
      [-1], [0], [1]  // n > 1
    ]
  }, {
    name: 'UniformRatio',
    p: () => []
  }, {
    name: 'VonMises',
    p: () => [Param.shape()],
    pi: [
      [-1], [0] // kappa > 0
    ]
  }, {
    name: 'Weibull',
    p: () => [Param.scale(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // lambda > 0
      [1, -1], [1, 0]   // k > 0
    ]
  }, {
    name: 'Wigner',
    p: () => [Param.scale()],
    pi: [
      [-1], [0] // R > 0
    ]
  }, {
    name: 'YuleSimon',
    p: () => [Param.shape() + 1],
    pi: [
      [-1], [0] // rho > 0
    ],
    skip: ['test-foreign']
  }, {
    name: 'Zeta',
    p: () => [Param.shape() + 1.8],
    pi: [
      [-1], [0], [1]  // s > 1
    ]
  }, {
    name: 'Zipf',
    p: () => [Param.shape() + 1],
    pi: [
      [-1, 100],      // s >= 1
      [1, -1], [1, 0] // N > 0
    ]
  }].forEach(d => {
    return
    //if (d.name !== 'Alpha') return
    describe(d.name, () => {
      if (typeof d.cases === 'undefined') {
        if (d.pi) {
          describe('constructor', () => utConstructor(d.name, d.pi))
        }

        describe('.sample()', () => utSample(d.name, d.p, d.skip))

        describe('.load(), .save()', () => utLoadSave(d.name, d.p))

        describe('.pdf(), .cdf(), .q()', () => utPdf(d.name, d.p))

        describe('.test()', () => {
          if (!d.skip || d.skip.indexOf('test-self') === -1) {
            it('should pass for own distribution', () => {
              utTest(d.name, d.p, 'self')
            })
          }

          if (!d.skip || d.skip.indexOf('test-foreign') === -1) {
            it('should reject foreign distribution', () => {
              utTest(d.name, d.p, 'foreign')
            })
          }
        })
      } else {
        describe('constructor', () => {
          d.cases.forEach(c => {
            if (c.pi) {
              describe(c.desc, () => utConstructor(c.name, c.pi))
            }
          })
        })

        describe('.sample()', () => {
          d.cases.forEach(c => {
            describe(c.desc, () => utSample(d.name, c.p))
          })
        })

        describe('.seed()', () => {
          d.cases.forEach(c => {
            describe(c.desc, () => utSeed(d.name, c.p))
          })
        })

        describe('.load(), .save()', () => {
          d.cases.forEach(c => {
            describe(c.desc, () => utLoadSave(d.name, c.p))
          })
        })

        describe('.pdf(), .cdf(), .q()', () => {
          d.cases.forEach(c => {
            describe(c.desc, () => utPdf(d.name, c.p))
          })
        })

        describe('.test()', () => {
          d.cases.forEach(c => {
            describe(c.desc, () => {
              it('should pass for own distribution', () => {
                utTest(d.name, c.p, 'self')
              })

              if (!c.skip || c.skip.indexOf('test-foreign') === -1) {
                it('should reject foreign distribution', () => {
                  utTest(d.name, c.p, 'foreign')
                })
              }
            })
          })
        })
      }
    })
  })

  // Improved test cases
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
        utils.trials(() => {
          const x0 = p()
          let degenerate = new dist.Degenerate(...x0)
          const samples = degenerate.sample(LAPS)
          return samples.reduce((s, d) => s && d === x0[0], true)
        })

        utils.trials(() => {
          let degenerate = new dist.Degenerate()
          const samples = degenerate.sample(LAPS)
          return samples.reduce((s, d) => s && d === 0, true)
        })
      })
    })

    describe('.pdf(), .cdf()', () => {
      it('differentiating cdf should give pdf', () => {
        utils.repeat(() => {
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
