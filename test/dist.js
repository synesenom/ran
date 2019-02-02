import { assert } from 'chai'
import { describe, it } from 'mocha'
import utils from './test-utils'
import { float, int } from '../src/core'
import * as dist from '../src/dist'

const LAPS = 1000
const MAX_AVG_DIFF = 1e-3
const EPSILON = 1e-6

/**
 * Runs a unit test for the .pdf() method of a generator.
 *
 * @method utPdf
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 */
function utPdf (name, params) {
  utils.trials(() => {
    const self = new dist[name](...params())

    const supp = self.support()
    if (self.type() === 'continuous') {
      return utils.cdf2pdf(
        self, [
          (supp[0].value !== null ? supp[0].value : -20) - 1,
          (supp[1].value !== null ? supp[1].value : 20) + 1
        ], LAPS
      ) < EPSILON
    } else {
      return utils.diffDisc(
        x => self.pdf(x),
        x => self.cdf(x),
        (supp[0].value !== null ? supp[0].value : -20) - 1,
        (supp[1].value !== null ? supp[1].value : 20) + 1
      ) < MAX_AVG_DIFF
    }
  })
}

/**
 * Runs a unit test for the .sample() method of a generator.
 *
 * @method utSample
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 */
function utSample (name, params) {
  utils.trials(() => {
    const self = new dist[name](...params())
    return self.type() === 'continuous'
      ? utils.ksTest(self.sample(LAPS), x => self.cdf(x))
      : utils.chiTest(self.sample(LAPS), x => self.pdf(x), params().length)
  })

  utils.trials(() => {
    const self = new dist[name]()
    return self.type() === 'continuous'
      ? utils.ksTest(self.sample(LAPS), x => self.cdf(x))
      : utils.chiTest(self.sample(LAPS), x => self.pdf(x), params().length)
  })
}

/**
 * Runs a unit test for the .test() method of a generator.
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
      })
      break
    case 'foreign':
      utils.trials(() => {
        const self = new dist[name](...params())

        const sample = self.sample(LAPS)

        const foreign = self.type() === 'continuous'
          ? new dist.ContinuousUniform(Math.min(...sample), Math.max(...sample))
          : new dist.DiscreteUniform(Math.min(...sample), Math.max(...sample))
        return !foreign.test(sample).passed
      })
      break
  }
}

const Param = {
  rangeMin () {
    return float(10)
  },

  rangeMax () {
    return float(10.1, 20)
  },

  shape () {
    return float(0.01, 5)
  },

  location () {
    return float(-5, 5)
  },

  scale () {
    return float(0.01, 5)
  },

  prob () {
    return float()
  },

  count () {
    return int(1, 20)
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
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.sample()
        }, 'Distribution._generator() is not implemented')
      })
    })

    describe('.pdf()', () => {
      it('should throw not implenented error', () => {
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.pdf(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.cdf()', () => {
      it('should throw not implenented error', () => {
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.cdf(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.survive()', () => {
      it('should throw not implemented error', () => {
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.survival(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.hazard()', () => {
      it('should throw not implenented error', () => {
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.hazard(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.cHazard()', () => {
      it('should throw not implenented error', () => {
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.cHazard(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.lnPdf()', () => {
      it('should throw not implenented error', () => {
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.lnPdf(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.L()', () => {
      it('should throw not implenented error', () => {
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.L([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.test()', () => {
      it('should throw not implenented error', () => {
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.test([0])
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
    name: 'BenktanderII',
    p: () => [Param.scale(), Param.prob()]
  }, {
    name: 'Benini',
    p: () => [Param.shape(), Param.shape(), Param.scale()]
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
    name: 'BoundedPareto',
    p: () => [Param.rangeMin(), Param.rangeMax(), Param.shape()]
  }, {
    name: 'Burr',
    p: () => [Param.shape(), Param.shape()]
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
    name: 'ContinuousUniform',
    p: () => [Param.rangeMin(), Param.rangeMax()],
    skip: ['test-foreign']
  }, {
    name: 'Custom',
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
    name: 'FishersZ',
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
    name: 'Geometric',
    p: () => [Param.prob()]
  }, {
    name: 'Gompertz',
    p: () => [Param.shape(), Param.scale()]
  }, {
    name: 'Gumbel',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'HalfNormal',
    p: () => [Param.scale()]
  }, {
    name: 'Hoyt',
    p: () => [Param.prob(), Param.scale()]
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
    p: () => [Param.shape(), Param.scale()]
  }, {
    name: 'IrwinHall',
    p: () => [Param.count() + 10]
  }, {
    name: 'JohnsonsSU',
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
    name: 'Logarithmic',
    p: () => [Param.rangeMin() + 1, Param.rangeMax() + 5]
  }, {
    name: 'LogCauchy',
    p: () => [Param.location(), Param.scale()]
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
    name: 'LogNormal',
    p: () => [Param.location(), Param.scale()]
  }, /*, {
      name: 'LogSeries',
      p: () => [float()]
    } */ {
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
    p: () => [Param.shape(), Param.scale()]
  }, {
    name: 'NegativeHypergeometric',
    p: () => [int(30, 40), int(10, 20), int(5, 10)]
  }, {
    name: 'NegativeBinomial',
    p: () => [Param.count(), Param.prob()]
  }, {
    name: 'Normal',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'Pareto',
    p: () => [Param.scale(), Param.shape()]
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
    name: 'Rademacher',
    p: () => []
  }, {
    name: 'Rayleigh',
    p: () => [Param.scale()]
  }, {
    name: 'Reciprocal',
    p: () => [Param.rangeMin(), Param.rangeMax()]
  }, {
    name: 'Soliton',
    p: () => [Param.count()]
  }, {
    name: 'Weibull',
    p: () => [Param.scale(), Param.shape()]
  }, {
    name: 'Wigner',
    p: () => [Param.scale()]
  }, {
    name: 'YuleSimon',
    p: () => [Param.shape()]
  }].forEach(d => {
    // if (d.name !== 'Bates') return

    describe(d.name, () => {
      if (typeof d.cases === 'undefined') {
        describe('.sample()', () => {
          it(`should generate values with ${d.name} distribution`, () => {
            utSample(d.name, d.p)
          })
        })

        describe('.pdf()', () => {
          it('differentiating cdf should give pdf ', () => {
            utPdf(d.name, d.p)
          })
        })

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
          d.cases.forEach(c => it(`should generate values with ${d.name} distribution [${c.desc}]`, () => {
            utSample(d.name, c.p)
          }))
        })

        describe('.pdf()', () => {
          d.cases.forEach(c => it(`differentiating cdf shuld give pdf [${c.desc}]`, () => {
            utPdf(d.name, c.p)
          }))
        })

        describe('.test()', () => {
          d.cases.forEach(c => {
            it(`should pass for own distribution [${c.desc}]`, () => {
              utTest(d.name, c.p, 'self')
            })
            if (!c.skip || c.skip.indexOf('test-foreign') === -1) {
              it(`should reject foreign distribution [${c.desc}]`, () => {
                utTest(d.name, c.p, 'foreign')
              })
            }
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
          const degenerate = new dist.Degenerate(...x0)
          const samples = degenerate.sample(LAPS)
          return samples.reduce((s, d) => s && d === x0[0], true)
        })

        utils.trials(() => {
          const degenerate = new dist.Degenerate()
          const samples = degenerate.sample(LAPS)
          return samples.reduce((s, d) => s && d === 0, true)
        })
      })
    })

    describe('.pdf()', () => {
      it('differentiating cdf should give pdf', () => {
        utils.repeat(() => {
          const x0 = p()
          const degenerate = new dist.Degenerate(...x0)
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
