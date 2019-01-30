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
          (supp[0].value !== null ? supp[0].value : -100) - 10,
          (supp[1].value !== null ? supp[1].value : 100) + 10
        ], LAPS
      ) < EPSILON
    } else {
      return utils.diffDisc(
        x => self.pdf(x),
        x => self.cdf(x),
        (supp[0].value !== null ? supp[0].value : -100) - 10,
        (supp[1].value !== null ? supp[1].value : 100) + 10
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
      ? utils.ksTtest(self.sample(LAPS), x => self.cdf(x))
      : utils.chiTest(self.sample(LAPS), x => self.pdf(x), 1)
  })

  utils.trials(() => {
    const self = new dist[name]()
    return self.type() === 'continuous'
      ? utils.ksTtest(self.sample(LAPS), x => self.cdf(x))
      : utils.chiTest(self.sample(LAPS), x => self.pdf(x), 1)
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
          ? new dist.UniformContinuous(Math.min(...sample), Math.max(...sample))
          : new dist.UniformDiscrete(Math.min(...sample), Math.max(...sample))
        return !foreign.test(sample).passed
      })
      break
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
    p: () => [float(10), float(10.1, 100)]
  }, {
    name: 'Bates',
    p: () => [int(5, 10), float(10), float(10.1, 20)]
  }, {
    name: 'Bernoulli',
    p: () => [float()]
  }, {
    name: 'Beta',
    p: () => [float(0.1, 3), float(0.1, 3)]
  }, {
    name: 'BetaPrime',
    p: () => [float(0.1, 3), float(0.1, 3)]
  }, {
    name: 'Binomial',
    cases: [{
      desc: 'small n',
      p: () => [int(10, 20), float()]
    }, {
      desc: 'small mean',
      p: () => [int(30, 100), float() / 105]
    }, {
      desc: 'large n, mean',
      p: () => [int(30, 100), float()]
    }]
  }, {
    name: 'BoundedPareto',
    p: () => [float(0.1, 5), float(5.1, 5), float(0.1, 3)]
  }, {
    name: 'Burr',
    p: () => [float(0.1, 5), float(0.1, 5)]
  }, {
    name: 'Cauchy',
    p: () => [float(), float(0.5, 2)]
  }, {
    name: 'Chi',
    p: () => [int(1, 10)]
  }, {
    name: 'Chi2',
    p: () => [int(1, 10)]
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
    name: 'Erlang',
    p: () => [int(1, 10), float(0.1, 5)]
  }, {
    name: 'ExponentialLogarithmic',
    p: () => [float(), float(0.1, 10)]
  }, {
    name: 'Exponential',
    p: () => [float(0.1, 5)]
  }, {
    name: 'F',
    p: () => [float(0.1, 5), float(0.1, 5)]
  }, {
    name: 'Frechet',
    p: () => [float(0.1, 5), float(0.1, 5), float(-5, 5)]
  }, {
    name: 'Gamma',
    p: () => [float(0.1, 10), float(0.1, 3)]
  }, {
    name: 'GeneralizedGamma',
    p: () => [float(0.1, 10), float(0.1, 5), float(0.1, 10)]
  }, {
    name: 'Geometric',
    p: () => [float(0.1, 1)]
  }, {
    name: 'Gompertz',
    p: () => [float(0.1, 5), float(0.1, 5), float(-5, 5)]
  }, {
    name: 'Gumbel',
    p: () => [float(-3, 3), float(0.1, 5)]
  }, {
    name: 'HalfNormal',
    p: () => [float(0.1, 10)]
  }, {
    name: 'Hoyt',
    p: () => [float(1), float(0.1, 5)]
  }, {
    name: 'Hypergeometric',
    p: () => [int(20, 40), int(20), int(10)]
  }, {
    name: 'InverseChi2',
    p: () => [int(1, 10)]
  }, {
    name: 'InverseGamma',
    p: () => [float(0.1, 5), float(0.1, 3)]
  }, {
    name: 'InverseGaussian',
    p: () => [float(0.1, 5), float(0.1, 5)]
  }, {
    name: 'IrwinHall',
    p: () => [int(5, 10)]
  }, {
    name: 'Laplace',
    p: () => [float(-2, 2), float(0.1, 5)]
  }, {
    name: 'Logarithmic',
    p: () => [float(1, 5), float(5.1, 10)]
  }, {
    name: 'LogCauchy',
    p: () => [float(-5, 5), float(0.1, 5)]
  }, {
    name: 'Logistic',
    p: () => [float(-5, 5), float(0.1, 5)]
  }, {
    name: 'LogLaplace',
    p: () => [float(-2, 2), float(0.1, 5)]
  }, {
    name: 'LogLogistic',
    cases: [{
      desc: 'positive shape parameter',
      p: () => [float(-5, 5), float(0.1, 5), float(0.1, 5)]
    }, {
      desc: 'negative shape parameter',
      p: () => [float(-5, 5), float(0.1, 5), float(-5, -0.1)]
    }, {
      desc: 'zero shape parameter',
      p: () => [float(-5, 5), float(0.1, 5), 0]
    }]
  }, {
    name: 'LogNormal',
    p: () => [float(-2, 2), float(0.1, 5)]
  }, /*, {
      name: 'LogSeries',
      p: () => [float()]
    } */ {
    name: 'Lomax',
    p: () => [float(0.1, 5), float(0.1, 5)]
  }, {
    name: 'Kumaraswamy',
    p: () => [float(0.1, 5), float(0.1, 5)]
  }, {
    name: 'Makeham',
    p: () => [float(0.1, 5), float(0.1, 5), float(0.1, 5)]
  }, {
    name: 'MaxwellBoltzmann',
    p: () => [float(0.1, 10)]
  }, {
    name: 'Nakagami',
    p: () => [float(0.5, 5), float(0.1, 5)]
  }, {
    name: 'NegativeHypergeometric',
    p: () => [int(30, 40), int(10, 20), int(5, 10)]
  }, {
    name: 'Normal',
    p: () => [float(-5, 5), float(0.1, 10)]
  }, {
    name: 'Pareto',
    p: () => [float(0.1, 5), float(0.1, 10)]
  }, {
    name: 'Poisson',
    cases: [{
      desc: 'low mean',
      p: () => [float(5, 20)]
    }, {
      desc: 'high mean',
      p: () => [float(31, 50)]
    }]
  }, {
    name: 'Rademacher',
    p: () => []
  }, {
    name: 'Rayleigh',
    p: () => [float(0.1, 5)]
  }, {
    name: 'UniformContinuous',
    p: () => [float(10), float(10.1, 100)],
    skip: ['test-foreign']
  }, {
    name: 'UniformDiscrete',
    p: () => [int(10), int(11, 100)],
    skip: ['test-foreign']
  }, {
    name: 'Weibull',
    p: () => [float(0.1, 10), float(0.1, 10)]
  }].forEach(d => {
    // if (d.name !== 'Nakagami') return

    describe(d.name, () => {
      if (typeof d.cases === 'undefined') {
        describe('.pdf()', () => {
          it('differentiating cdf should give pdf ', () => {
            utPdf(d.name, d.p)
          })
        })

        describe('.sample()', () => {
          it(`should generate values with ${d.name} distribution`, () => {
            utSample(d.name, d.p)
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
