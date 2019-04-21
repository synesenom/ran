import { assert } from 'chai'
import { describe, it } from 'mocha'
import utils from './test-utils'
import { float, int } from '../src/core'
import * as dist from '../src/dist'
import InvalidDiscrete from '../src/dist/_invalid'

const LAPS = 1000

/**
 * Runs unit tests for the .sample() method of a generator.
 *
 * @method utSample
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 */
function utSample (name, params) {
  it('sample should contain valid numbers', () => {
    utils.trials(() => {
      const sample = new dist[name](...params()).sample(1000)
      return sample.reduce((acc, d) => acc && Number.isFinite(d) && isFinite(d), true)
    })
  })

  it('sample should be within the range of the support', () => {
    utils.trials(() => {
      const self = new dist[name](...params())
      const supp = self.support()
      const sample = self.sample(1000)
      return sample.reduce((acc, d) => {
        let above = !Number.isFinite(supp[0].value) || ((supp[0].closed && d >= supp[0].value) || (!supp[0].closed && d > supp[0].value))
        let below = !Number.isFinite(supp[1].value) || ((supp[1].closed && d <= supp[1].value) || (!supp[1].closed && d < supp[1].value))
        return acc && above && below
      }, true)
    })
  })

  it('values should be distributed correctly with default parameters', () => {
    const self = new dist[name]()
    return self.type() === 'continuous'
      ? utils.ksTest(self.sample(LAPS), x => self.cdf(x))
      : utils.chiTest(self.sample(LAPS), x => self.pdf(x), params().length)
  })

  it('values should be distributed correctly with random parameters', () => {
    utils.trials(() => {
      const self = new dist[name](...params())
      return self.type() === 'continuous'
        ? utils.ksTest(self.sample(LAPS), x => self.cdf(x))
        : utils.chiTest(self.sample(LAPS), x => self.pdf(x), params().length)
    }, 3)
  })

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

/**
 * Runs unit tests for the .pdf() method of a generator.
 *
 * @method utPdf
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 */
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
    utils.trials(() => utils.Tests.pdf2cdf(new dist[name](...params()), LAPS), 4)
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

/**
 * Runs unit tests for the .test() method of a generator.
 *
 * @method utTest
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 * @param {string} type Type of test (with self or foreign distribution).
 */
function utTest (name, params, type = 'self') {
  switch (type) {
    case 'self':
      utils.trials(() => {
        const self = new dist[name](...params())
        return self.test(self.sample(LAPS)).passed
      }, 3)
      break

    case 'foreign':
      utils.trials(() => {
        const self = new dist[name](...params())

        const sample = self.sample(LAPS)

        const foreign = self.type() === 'continuous'
          ? new dist.Uniform(Math.min(...sample), Math.max(...sample))
          : new dist.DiscreteUniform(Math.min(...sample), Math.max(...sample))
        return !foreign.test(sample).passed
      }, 3)
      break
  }
}

const Param = {
  rangeMin () {
    return float(10)
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
    return float()
  },

  count () {
    return int(3, 20)
  },

  degree () {
    return int(1, 10)
  },

  rate () {
    return float(10)
  }
}

describe('dist', () => {
  // Base class
  describe('Distribution', () => {
    describe('.sample()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.sample()
        }, 'Distribution._generator() is not implemented')
      })
    })

    describe('.pdf()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.pdf(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.cdf()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.cdf(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.survive()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.survival(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.hazard()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.hazard(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.cHazard()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.cHazard(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.lnPdf()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.lnPdf(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.lnL()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.lnL([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.test()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.test([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.aic()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.aic([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.bic()', () => {
      it('should throw not implemented error', () => {
        const invalid = new InvalidDiscrete()
        assert.throws(() => {
          invalid.bic([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })
  });

  // Ordinary distributions
  [{
    name: 'Arcsine',
    p: () => [Param.rangeMin(), Param.rangeMax()]
  }, {
    name: 'Bates',
    p: () => [Param.count(), Param.rangeMin(), Param.rangeMax()]
  }, {
    name: 'Benini',
    p: () => [Param.shape(), Param.shape(), Param.scale()]
  }, {
    name: 'BenktanderII',
    cases: [{
      desc: 'high shape parameter',
      p: () => [Param.scale(), 1 - Param.prob() / 1000]
    }, {
      desc: 'unit shape parameter',
      p: () => [Param.scale(), 1]
    }, {
      desc: 'normal shape parameter',
      p: () => [Param.scale(), Math.min(0.9, Param.prob())]
    }]
  }, {
    name: 'Bernoulli',
    p: () => [Param.prob()]
  }, {
    name: 'Beta',
    p: () => [Param.shape(), Param.shape()]
  }, {
    name: 'BetaPrime',
    p: () => [Param.shape(), Param.shape()]
  }, {
    name: 'BetaRectangular',
    p: () => [Param.shape(), Param.shape(), Param.prob(), Param.rangeMin(), Param.rangeMax()]
  }, {
    name: 'Binomial',
    cases: [{
      desc: 'small n',
      p: () => [int(10, 20), Param.prob()]
    }, {
      desc: 'small mean',
      p: () => [int(30, 100), Param.prob() / 105]
    }, {
      desc: 'large n, mean',
      p: () => [int(30, 100), Param.prob()]
    }]
  }, {
    name: 'BirnbaumSaunders',
    p: () => [Param.location(), Param.scale(), Param.shape()]
  }, {
    name: 'BoundedPareto',
    p: () => [Param.rangeMin(), Param.rangeMax(), Param.shape()]
  }, {
    name: 'Bradford',
    p: () => [Param.shape()]
  }, {
    name: 'Burr',
    p: () => [Param.shape(), Param.shape()]
  }, {
    name: 'Categorical',
    cases: [{
      desc: 'small n',
      p: () => [Array.from({ length: int(0, 1) }, Math.random)],
      skip: ['test-foreign']
    }, {
      desc: 'moderate n',
      p: () => [Array.from({ length: int(10, 100) }, Math.random)]
    }, {
      desc: 'large n',
      p: () => [Array.from({ length: int(101, 120) }, Math.random)],
      skip: ['test-foreign']
    }]
  }, {
    name: 'Cauchy',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'Chi',
    p: () => [Param.degree()]
  }, {
    name: 'Chi2',
    p: () => [Param.degree()]
  }, {
    name: 'Dagum',
    p: () => [Param.shape(), Param.shape(), Param.scale()]
  }, {
    name: 'DiscreteUniform',
    p: () => [int(10), int(11, 100)],
    skip: ['test-foreign']
  }, {
    name: 'DiscreteWeibull',
    p: () => [Param.prob(), Param.shape()]
  }, {
    name: 'Erlang',
    p: () => [Param.degree(), Param.rate()]
  }, {
    name: 'ExponentialLogarithmic',
    p: () => [Param.prob(), Param.scale()]
  }, {
    name: 'Exponential',
    p: () => [Param.rate()]
  }, {
    name: 'F',
    p: () => [Param.degree(), Param.degree()]
  }, {
    name: 'FisherZ',
    p: () => [Param.degree(), Param.degree()]
  }, {
    name: 'FlorySchulz',
    p: () => [Param.prob()],
    skip: ['test-foreign']
  }, {
    name: 'Frechet',
    p: () => [Param.shape(), Param.scale(), Param.location()]
  }, {
    name: 'Gamma',
    p: () => [Param.shape(), Param.rate()]
  }, {
    name: 'GammaGompertz',
    p: () => [Param.scale(), Param.shape(), Param.shape()]
  }, {
    name: 'GeneralizedGamma',
    p: () => [Param.scale(), Param.shape(), Param.shape()]
  }, {
    name: 'GeneralizedPareto',
    cases: [{
      desc: 'positive shape parameter',
      p: () => [Param.location(), Param.scale(), Param.shape()]
    }, {
      desc: 'negative shape parameter',
      p: () => [Param.location(), Param.scale(), float(-5, -0.1)]
    }, {
      desc: 'zero shape parameter',
      p: () => [Param.location(), Param.scale(), 0]
    }]
  }, {
    name: 'Geometric',
    p: () => [Param.prob()]
  }, {
    name: 'Gompertz',
    p: () => [Param.shape(), Param.scale()]
  }, {
    name: 'Gumbel',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'HalfLogistic',
    p: () => []
  }, {
    name: 'HalfNormal',
    p: () => [Param.scale()]
  }, {
    name: 'Hoyt',
    p: () => [Param.prob(), Param.scale()]
  }, {
    name: 'HyperbolicSecant',
    p: () => []
  }, {
    name: 'Hypergeometric',
    p: () => [int(20, 40), int(20), int(10)]
  }, {
    name: 'InverseChi2',
    p: () => [Param.degree()]
  }, {
    name: 'InverseGamma',
    p: () => [Param.shape(), Param.scale()]
  }, {
    name: 'InverseGaussian',
    p: () => [Param.scale(), Param.shape()]
  }, {
    name: 'IrwinHall',
    p: () => [Param.count()],
    skip: ['test-foreign']
  }, {
    name: 'JohnsonSU',
    p: () => [Param.location(), Param.scale(), Param.scale(), Param.location()]
  }, {
    name: 'JohnsonSB',
    p: () => [Param.location(), Param.scale(), Param.scale(), Param.location()]
  }, {
    name: 'Kumaraswamy',
    p: () => [Param.shape(), Param.shape()]
  }, {
    name: 'Laplace',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'Levy',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'Lindley',
    p: () => [Param.shape()]
  }, {
    name: 'Logarithmic',
    p: () => [Param.rangeMin() + 1, Param.rangeMax() + 5]
  }, {
    name: 'LogCauchy',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'LogGamma',
    p: () => [Param.shape(), Param.rate(), Param.location()]
  }, {
    name: 'Logistic',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'LogisticExponential',
    p: () => [Param.scale(), Param.shape()]
  }, {
    name: 'LogitNormal',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'LogLaplace',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'LogLogistic',
    p: () => [Param.scale(), Param.shape()]
  }, {
    name: 'LogNormal',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'LogSeries',
    p: () => [Param.prob()]
  }, {
    name: 'Lomax',
    p: () => [Param.scale(), Param.shape()]
  }, {
    name: 'Makeham',
    p: () => [Param.shape(), Param.rate(), Param.scale()]
  }, {
    name: 'MaxwellBoltzmann',
    p: () => [Param.scale()]
  }, {
    name: 'Nakagami',
    p: () => [Param.shape() + 0.5, Param.scale()]
  }, {
    name: 'NegativeHypergeometric',
    p: () => [int(30, 40), int(10, 20), int(5, 10)]
  }, {
    name: 'NegativeBinomial',
    p: () => [Param.count(), Param.prob()]
  }, {
    name: 'NoncentralChi2',
    p: () => [Param.degree(), Param.scale()]
  }, {
    name: 'NoncentralChi',
    p: () => [4, 4]
  }, {
    name: 'Normal',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'Pareto',
    p: () => [Param.scale(), Param.shape()]
  }, {
    name: 'PERT',
    p: () => [Param.rangeMin(), Param.rangeIn(), Param.rangeMax()]
  }, {
    name: 'Poisson',
    cases: [{
      desc: 'low mean',
      p: () => [float(20)]
    }, {
      desc: 'high mean',
      p: () => [float(31, 50)]
    }]
  }, {
    name: 'PowerLaw',
    p: () => [Param.scale()]
  }, {
    name: 'Rademacher',
    p: () => []
  }, {
    name: 'RaisedCosine',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'Rayleigh',
    p: () => [Param.scale()]
  }, {
    name: 'Reciprocal',
    p: () => [Param.rangeMin(), Param.rangeMax()]
  }, {
    name: 'ReciprocalInverseGaussian',
    p: () => [Param.scale(), Param.shape()]
  }, {
    name: 'Rice',
    p: () => [Param.shape(), Param.scale()]
  }, {
    name: 'ShiftedLogLogistic',
    cases: [{
      desc: 'positive shape parameter',
      p: () => [Param.location(), Param.scale(), float(0.1, 5)]
    }, {
      desc: 'negative shape parameter',
      p: () => [Param.location(), Param.scale(), float(-5, -0.1)]
    }, {
      desc: 'zero shape parameter',
      p: () => [Param.location(), Param.scale(), 0]
    }]
  }, {
    name: 'Skellam',
    p: () => [float(1, 10), float(1, 10)]
  }, {
    name: 'Slash',
    p: () => []
  }, {
    name: 'Soliton',
    p: () => [Param.count()]
  }, {
    name: 'StudentT',
    p: () => [Param.shape()]
  }, {
    name: 'Triangular',
    p: () => [Param.rangeMin(), Param.rangeMax(), Param.rangeIn()]
  }, {
    name: 'Uniform',
    p: () => [Param.rangeMin(), Param.rangeMax()],
    skip: ['test-foreign']
  }, {
    name: 'UQuadratic',
    p: () => [Param.rangeMin(), Param.rangeMax()]
  }, {
    name: 'Weibull',
    p: () => [Param.scale(), Param.shape()]
  }, {
    name: 'Wigner',
    p: () => [Param.scale()]
  }, {
    name: 'YuleSimon',
    p: () => [Param.shape() + 0.2],
    skip: ['test-foreign']
  }, {
    name: 'Zeta',
    p: () => [Param.shape() + 1.5]
  }, {
    name: 'Zipf',
    p: () => [Param.shape() + 1]
  }].forEach(d => {
    // if (d.name !== 'Beta') return

    describe(d.name, () => {
      if (typeof d.cases === 'undefined') {
        describe('.sample()', () => utSample(d.name, d.p))

        // TODO Add .q() to description
        describe('.pdf(), .cdf()', () => utPdf(d.name, d.p))

        describe('.test()', () => {
          it('should pass for own distribution', () => {
            utTest(d.name, d.p, 'self')
          })
          if (!d.skip || d.skip.indexOf('test-foreign') === -1) {
            it('should reject foreign distribution', () => {
              utTest(d.name, d.p, 'foreign')
            })
          }
        })
      } else {
        describe('.sample()', () => {
          d.cases.forEach(c => {
            describe(c.desc, () => utSample(d.name, c.p))
          })
        })

        // TODO Add .q() to description
        describe('.pdf(), .cdf()', () => {
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

    // TODO Add .q() to description
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
