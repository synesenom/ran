import { assert } from 'chai'
import { describe, it } from 'mocha'
import utils from './test-utils'
import { float, int } from '../src/core'
import * as dist from '../src/dist'
import InvalidDiscrete from '../src/dist/_invalid'

const LAPS = 1000

/*
let TD1 = new dist.BetaNegativeBinomial(4.8, 0.7, 2)
for (let x = 0; x <= 100; x++) {
  console.log(
    x,
    TD1.pdf(x),
    TD1.cdf(x)
  )
}
*/

function utConstructor(name, invalidParams) {
  it('should throw error if params are invalid', () => {
    invalidParams.forEach(p => {
      assert.throws(() => {
        new dist[name](...p)
      })
    })
  })
}

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
      assert(self.type() === 'continuous'
        ? utils.ksTest(self.sample(LAPS), x => self.cdf(x))
        : utils.chiTest(self.sample(LAPS), x => self.pdf(x), params().length))
  })

  it('values should be distributed correctly with random parameters', () => {
    utils.trials(() => {
      const self = new dist[name](...params())
      return self.type() === 'continuous'
        ? utils.ksTest(self.sample(LAPS), x => self.cdf(x))
        : utils.chiTest(self.sample(LAPS), x => self.pdf(x), params().length)
    }, 8)
  })
}

function utSeed(name, params) {
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

function utLoadSave(name, params) {
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
      }, 7)
      break

    case 'foreign':
      utils.trials(() => {
        const self = new dist[name](...params())

        const sample = self.sample(LAPS)

        const foreign = self.type() === 'continuous'
          ? new dist.Uniform(Math.min(...sample), Math.max(...sample))
          : new dist.DiscreteUniform(Math.min(...sample), Math.max(...sample) + 1)
        return !foreign.test(sample).passed
      }, 7)
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
  [{
    name: 'Alpha',
    p: () => [Param.shape()],
    pi: [
      [-1], [0] // alpha > 0
    ]
  }, {
    name: 'Anglit',
    p: () => []
  }, {
    name: 'Arcsine',
    p: () => [Param.rangeMin(), Param.rangeMax()],
    pi: [
      [1, 1], [2, 1]  // a < b
    ]
  }, {
    name: 'Bates',
    p: () => [Param.count(), Param.rangeMin(), Param.rangeMax()],
    pi: [
      [-1, 0, 1], [0, 0, 1],  // n > 0
      [10, 1, 1], [10, 2, 1]    // a < b
    ]
  }, {
    name: 'Benini',
    p: () => [Param.shape(), Param.shape(), Param.scale()],
    pi: [
      [-1, 1, 1], [0, 1, 1],  // alpha > 0
      [1, -1, 1], [1, 0, 1],  // beta > 0
      [1, 1, -1], [1, 1, 0]   // sigma > 0
    ]
  }, {
    name: 'BenktanderII',
    cases: [{
      desc: 'high shape parameter',
      p: () => [Param.scale(), 1 - Param.prob() / 1000],
      pi: [
        [-1, 0.5], [0, 0.5],      // a > 0
        [1, -1], [1, 0], [1, 1.5] // 0 < b <= 1
      ]
    }, {
      desc: 'unit shape parameter',
      p: () => [Param.scale(), 1]
    }, {
      desc: 'normal shape parameter',
      p: () => [Param.scale(), Math.min(0.9, Param.prob())]
    }]
  }, {
    name: 'Bernoulli',
    p: () => [Param.prob()],
    pi: [
      [-1], [2] // 0 <= p <= 1
    ]
  }, {
    name: 'Beta',
    p: () => [Param.shape(), Param.shape()],
    pi: [
      [-1, 2], [0, 2], // alpha > 0
      [2, -1], [2, 0]  // beta > 0
    ]
  }, {
    name: 'BetaPrime',
    p: () => [Param.shape(), Param.shape()],
    pi: [
      [-1, 2], [0, 2], // alpha > 0
      [2, -1], [2, 0]  // beta > 0
    ]
  }, {
    name: 'BetaRectangular',
    p: () => [Param.shape(), Param.shape(), Param.prob(), Param.rangeMin(), Param.rangeMax()],
    pi: [
      [1, 1, -1, 0, 1], [1, 1, 2, 0, 1],    // 0 <= theta <= 1
      [1, 1, 0.5, 1, 1], [1, 1, 0.5, 2, 1], // a < b
    ]
  }, {
    name: 'Binomial',
    cases: [{
      desc: 'small n',
      p: () => [int(5, 20), Param.prob()],
      pi: [
        [-1, 0.5],            // n >= 0
        [100, -1], [100, 2],  // 0 <= p <= 1
      ]
    }, {
      desc: 'small mean',
      p: () => [int(30, 100), Param.prob() / 105]
    }, {
      desc: 'large n, mean',
      p: () => [int(30, 100), Param.prob()]
    }]
  }, {
    name: 'BirnbaumSaunders',
    p: () => [Param.location(), Param.scale(), Param.shape()],
    pi: [
      [0, -1, 1], [0, 0, 1],  // beta > 0
      [0, 1, -1], [0, 1, 0],  // gamma > 0
    ]
  }, {
    name: 'BoundedPareto',
    p: () => [Param.rangeMin(), Param.rangeMax(), Param.shape()],
    pi: [
      [-1, 10, 1], [0, 10, 1],  // L > 0
      [1, -1, 1], [1, 0, 1],    // H > 0
      [10, 10, 1], [12, 10, 1], // L < H
      [1, 10, -1], [1, 10, 0],  // alpha > 0
    ]
  }, {
    name: 'Bradford',
    p: () => [Param.shape()],
    pi: [
      [-1], [0] // c > 0
    ]
  }, {
    name: 'Burr',
    p: () => [Param.shape(), Param.shape()],
    pi: [
      [-1, 1], [0, 1], // c > 0
      [1, -1], [1, 0], // k > 0
    ]
  }, {
    name: 'Categorical',
    cases: [{
      desc: 'small n',
      p: () => [Array.from({ length: int(0, 1) }, Math.random)],
      pi: [
        [[-1, 1, 1], 0],  // w_i > 0
      ],
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
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0]  // gamma > 0
    ]
  }, {
    name: 'Chi',
    cases: [{
      desc: 'k = 1',
      p: () => [1],
      pi: [
        [-1], [0] // k > 0
      ]
    }, {
      desc: 'k > 1',
      p: () => [Param.degree()]
    }],
  }, {
    name: 'Chi2',
    p: () => [Param.degree()],
    pi: [
      [-1], [0] // k > 0
    ]
  }, {
    name: 'Dagum',
    p: () => [Param.shape(), Param.shape(), Param.scale()],
    pi: [
      [-1, 1, 1], [0, 1, 1],  // p > 0
      [1, -1, 1], [1, 0, 1],  // a > 0
      [1, 1, -1], [1, 1, 0]   // b > 0
    ]
  }, {
    name: 'Delaporte',
    p: () => [Param.scale(), Param.shape(), Param.shape()],
    pi: [
      [-1, 1, 1], [0, 1, 1],  // alpha > 0
      [1, -1, 1], [1, 0, 1],  // beta > 0
      [1, 1, -1], [1, 1, 0]   // lambda > 0
    ]
  }, {
    name: 'DiscreteUniform',
    p: () => [int(10), int(11, 100)],
    pi: [
      [100, 100], [105, 100]  // xmin < xmax
    ],
    skip: ['test-foreign']
  }, {
    name: 'DiscreteWeibull',
    p: () => [Param.prob(), Param.shape()],
    pi: [
      [-1, 1], [0, 1], [1, 1], [2, 1],  // 0 < q < 1
      [0.5, -1], [0.5, 0]               // beta > 0
    ]
  }, {
    name: 'DoubleGamma',
    p: () => [Param.shape(), Param.rate()],
    pi: [
      [-1, 1], [0, 1],  // alpha > 0
      [1, -1], [1, 0]   // beta > 0
    ]
  }, {
    name: 'DoubleWeibull',
    p: () => [Param.scale(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // lambda > 0
      [1, -1], [1, 0]   // k > 0
    ]
  }, {
    name: 'Erlang',
    p: () => [Param.degree(), Param.rate()],
    pi: [
      [-1, 1], [0, 1], // k > 0
      [1, -1], [1, 0]  // lambda > 0
    ]
  }, {
    name: 'Exponential',
    p: () => [Param.rate()],
    pi: [
      [-1], [0] // lambda > 0
    ]
  }, {
    name: 'ExponentialLogarithmic',
    p: () => [Param.prob(), Param.scale()],
    pi: [
      [-1, 1], [0, 1], [1, 1], [2, 1],  // 0 < p < 1
      [0.5, -1], [0.5, 0]               // beta > 0
    ]
  }, {
    name: 'F',
    p: () => [Param.degree(), Param.degree()],
    pi: [
      [-1, 2], [0, 2],  // d1 > 0
      [2, -1], [2, 0]   // d2 > 0
    ]
  }, {
    name: 'FisherZ',
    p: () => [Param.degree(), Param.degree()],
    pi: [
      [-1, 2], [0, 2],  // d1 > 0
      [2, -1], [2, 0]   // d2 > 0
    ]
  }, {
    name: 'FlorySchulz',
    p: () => [Param.prob()],
    pi: [
      [-1], [0], [1], [2] // 0 < a < 1
    ],
    skip: ['test-foreign']
  }, {
    name: 'Frechet',
    p: () => [Param.shape(), Param.scale(), Param.location()],
    pi: [
      [-1, 1, 0], [0, 1, 0],  // alpha > 0
      [1, -1, 0], [1, 0, 0]   // s > 0
    ]
  }, {
    name: 'Gamma',
    p: () => [Param.shape(), Param.rate()],
    pi: [
      [-1, 1], [0, 1],  // alpha > 0
      [1, -1], [1, 0]   // beta > 0
    ]
  }, {
    name: 'GammaGompertz',
    p: () => [Param.scale(), Param.shape(), Param.shape()],
    pi: [
      [-1, 1, 1], [0, 1, 1],  // b > 0
      [1, -1, 1], [1, 0, 1],  // s > 0
      [1, 1, -1], [1, 1, 0]   // beta > 0
    ]
  }, {
    name: 'GeneralizedGamma',
    p: () => [Param.scale(), Param.shape(), Param.shape()],
    pi: [
      [-1, 1, 1], [0, 1, 1],  // a > 0
      [1, -1, 1], [1, 0, 1],  // d > 0
      [1, 1, -1], [1, 1, 0]   // p > 0
    ]
  }, {
    name: 'GeneralizedHermite',
    p: () => [Param.rate(), Param.rate(), Param.degree() + 1],
    pi: [
      [-1, 1, 2],                       // a1 > 0
      [1, -1, 2],                       // a2 > 0
      [1, 1, -1], [1, 1, 0], [1, 1, 1]  // m > 1
    ]
  }, {
    name: 'GeneralizedPareto',
    cases: [{
      desc: 'positive shape parameter',
      p: () => [Param.location(), Param.scale(), Param.shape()],
      pi: [
        [0, 1, -1], [0, 1, 0] // sigma > 0
      ]
    }, {
      desc: 'negative shape parameter',
      p: () => [Param.location(), Param.scale(), -Param.shape()]
    }, {
      desc: 'zero shape parameter',
      p: () => [Param.location(), Param.scale(), 0]
    }]
  }, {
    name: 'Geometric',
    p: () => [Param.prob()],
    pi: [
      [-1], [0], [2]  // 0 < p <= 1
    ]
  }, {
    name: 'Gilbrat',
    p: () => []
  }, {
    name: 'Gompertz',
    p: () => [Param.shape(), Param.scale()],
    pi: [
      [-1, 1], [0, 1],  // eta > 0
      [1, -1], [1, 0]   // b > 0
    ]
  }, {
    name: 'Gumbel',
    p: () => [Param.location(), Param.scale()],
    pi: [
      [0, -1], [0, 0] // beta > 0
    ]
  }, {
    name: 'HalfLogistic',
    p: () => []
  }, {
    name: 'HalfNormal',
    p: () => [Param.scale()]
  }, {
    name: 'Hoyt',
    cases: [{
      desc: 'q < 0.5',
      p: () => [Param.prob() / 2, Param.scale()],
      pi: [
        [-1, 1], [0, 1], [2, 1],  // 0 < q <= 1
        [0.5, -1], [0.5, 0]       // omega > 0
      ]
    }, {
      desc: 'normal q',
      p: () => [Param.prob(), Param.scale()]
    }]
  }, {
    name: 'HyperbolicSecant',
    p: () => []
  }, {
    name: 'Hyperexponential',
    p: () => [Array.from({ length: Param.degree() + 1 }).map(() => ({ weight: Param.shape(), rate: Param.rate() }))],
    pi: [
      [[-1, 1, 1]], [[0, 1, 1]],  // lambda_i > 0
      [[]]                        // n > 0
    ]
  }, {
    name: 'Hypergeometric',
    p: () => [int(20, 40), int(20), int(10)],
    pi: [
      [-1, 5, 5], [0, 5, 5],    // N > 0
      [10, -1, 5], [10, 12, 5], // 0 <= K <= N
      [10, 5, -1], [10, 5, 12]  // 0 <= n <= N
    ]
  }, {
    name: 'InverseChi2',
    p: () => [Param.degree() + 1],
    pi: [
      [-1], [0] // nu > 0
    ]
  }, {
    name: 'InverseGamma',
    p: () => [Param.shape(), Param.scale()],
    pi: [
      [-1, 1], [0, 1],  // alpha > 0
      [1, -1], [1, 0]   // beta > 0
    ]
  }, {
    name: 'InverseGaussian',
    p: () => [Param.scale(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // mu > 0
      [1, -1], [1, 0]   // lambda > 0
    ]
  }, {
    name: 'IrwinHall',
    p: () => [Param.count()],
    pi: [
      [-1], [0] // n > 0
    ],
    skip: ['test-foreign']
  }, {
    name: 'JohnsonSU',
    p: () => [Param.location(), Param.scale(), Param.scale(), Param.location()],
    pi: [
      [0, -1, 1, 0], [0, 0, 1, 0],  // delta > 0
      [0, 1, -1, 0], [0, 1, 0, 0]   // lambda > 0
    ]
  }, {
    name: 'JohnsonSB',
    p: () => [Param.location(), Param.scale(), Param.scale(), Param.location()],
    pi: [
      [0, -1, 1, 0], [0, 0, 1, 0],  // delta > 0
      [0, 1, -1, 0], [0, 1, 0, 0]   // lambda > 0
    ]
  }, {
    name: 'Kumaraswamy',
    p: () => [Param.shape(), Param.shape()],
    pi: [
      [-1, 1], [0, 1],  // a > 0
      [1, -1], [1, 0]   // b > 0
    ]
  }, {
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
    p: () => [Param.degree()],
    pi: [
      [-1], [0]
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
    //if (d.name !== 'R') return

    describe(d.name, () => {
      if (typeof d.cases === 'undefined') {
        if (d.pi) {
          describe('constructor', () => utConstructor(d.name, d.pi))
        }

        describe('.sample()', () => utSample(d.name, d.p))

        describe('.seed()', () => utSeed(d.name, d.p))

        describe('.load(), .save()', () => utLoadSave(d.name, d.p))

        describe('.pdf(), .cdf(), .q()', () => utPdf(d.name, d.p))

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
