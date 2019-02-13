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
  it('pdf should return valid numbers', () => {
    utils.trials(() => {
      const self = new dist[name](...params())

      let isNum = true
      for (let x = -100; x <= 100; x++) {
        let pdf = self.pdf(x)
        isNum &= isFinite(pdf) && Number.isFinite(pdf)
        if (!isFinite(pdf) || !Number.isFinite(pdf)) {
          console.log(pdf)
        }
      }
      return isNum
    }, true)
  })

  it('cdf should return valid numbers', () => {
    utils.trials(() => {
      const self = new dist[name](...params())

      let isNum = true
      for (let x = -100; x <= 100; x++) {
        let cdf = self.cdf(x)
        isNum &= isFinite(cdf) && Number.isFinite(cdf)
      }
      return isNum
    }, true)
  })

  it('pdf/pmf should be de differential or difference of cdf', () => {
    utils.trials(() => {
      const self = new dist[name](...params())

      const supp = self.support()
      if (self.type() === 'continuous') {
        return utils.cdf2pdf(
          self, [
            (supp[0].value !== null ? supp[0].value : -30) - 3,
            (supp[1].value !== null ? supp[1].value : 30) + 3
          ], LAPS
        ) < EPSILON
      } else {
        return utils.diffDisc(
          x => self.pdf(x),
          x => self.cdf(x),
          (supp[0].value !== null ? supp[0].value : -30) - 3,
          (supp[1].value !== null ? supp[1].value : 30) + 3
        ) < MAX_AVG_DIFF
      }
    }, true)
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
  it('sample should contain only valid numbers', () => {
    utils.trials(() => {
      const sample = new dist[name](...params()).sample(1000)
      return sample.reduce((acc, d) => acc && Number.isFinite(d) && isFinite(d), true)
    }, true)
  })

  it('values should be distributed correctly with default parameters', () => {
    utils.trials(() => {
      const self = new dist[name]()
      return self.type() === 'continuous'
        ? utils.ksTest(self.sample(LAPS), x => self.cdf(x))
        : utils.chiTest(self.sample(LAPS), x => self.pdf(x), params().length)
    })
  })

  it('values should be distributed correctly with random parameters', () => {
    utils.trials(() => {
      const self = new dist[name](...params())
      return self.type() === 'continuous'
        ? utils.ksTest(self.sample(LAPS), x => self.cdf(x))
        : utils.chiTest(self.sample(LAPS), x => self.pdf(x), params().length)
    })
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

  rangeIn () {
    return float(10, 20)
  },

  rangeMax () {
    return float(20, 30)
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
  /* let ih = new dist.Gamma(3, 1)
  for (let i = 0; i < 300; i++) {
    console.log(i / 100, ih.pdf(i / 100), ih.cdf(i / 100))
    // ih.cdf(i / 100)
  }
  return */

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

    describe('.lnL()', () => {
      it('should throw not implenented error', () => {
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.lnL([0])
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

    describe('.aic()', () => {
      it('should throw not implenented error', () => {
        const invalid = new dist.InvalidDiscrete()
        assert.throws(() => {
          invalid.aic([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.bic()', () => {
      it('should throw not implenented error', () => {
        const invalid = new dist.InvalidDiscrete()
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
    name: 'BirnbaumSaunders',
    p: () => [Param.location(), Param.scale(), Param.shape()]
  }, {
    name: 'BoundedPareto',
    p: () => [Param.rangeMin(), Param.rangeMax(), Param.shape()]
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
    name: 'ContinuousUniform',
    p: () => [Param.rangeMin(), Param.rangeMax()],
    skip: ['test-foreign']
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
    p: () => [Param.shape(), Param.scale()]
  }, {
    name: 'IrwinHall',
    p: () => [Param.count() + 10]
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
    name: 'Logarithmic',
    p: () => [Param.rangeMin() + 1, Param.rangeMax() + 5]
  }, {
    name: 'LogCauchy',
    p: () => [Param.location(), Param.scale()]
  }, {
    name: 'LogGamma',
    p: () => [Param.shape(), Param.rate()]
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
    name: 'StudentT',
    p: () => [Param.shape()]
  }, {
    name: 'Triangular',
    p: () => [Param.rangeMin(), Param.rangeMax(), Param.rangeIn()]
  }, {
    name: 'Weibull',
    p: () => [Param.scale(), Param.shape()]
  }, {
    name: 'Wigner',
    p: () => [Param.scale()]
  }, {
    name: 'YuleSimon',
    p: () => [Param.shape()]
  }, {
    name: 'Zeta',
    p: () => [Param.shape() + 2]
  }, {
    name: 'Zipf',
    p: () => [Param.shape() + 1]
  }].forEach(d => {
    // if (d.name !== 'LogSeries') return

    describe(d.name, () => {
      if (typeof d.cases === 'undefined') {
        describe('.sample()', () => utSample(d.name, d.p))

        describe('.pdf()', () => utPdf(d.name, d.p))

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
          d.cases.forEach(c => utSample(d.name, c.p))
        })

        describe('.pdf()', () => {
          d.cases.forEach(c => utPdf(d.name, c.p))
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
