import { float, int } from '../src/core'

const Param = {
  rangeMin () {
    return float(1, 10)
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
    return int(2, 20)
  },

  degree () {
    return int(1, 10)
  },

  rate () {
    return float(0.1, 10)
  }
}

export default [{
  name: 'Alpha',
  invalidParams: [
    [-1, 1], [0, 1],  // alpha > 0
    [1, -1], [1, 0]   // beta > 0
  ],
  foreign: {
    generator: 'Pareto',
    params: () => [Param.scale(), Param.shape()]
  },
  cases: [{
    params: () => [Param.shape(), Param.scale()],
  }]
}, {
  name: 'Anglit',
  invalidParams: [
    [0, -1], [0, 0]   // beta > 0
  ],
  foreign: {
    generator: 'Arcsine',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.location(), Param.scale()]
  }]
}, {
  name: 'Arcsine',
  invalidParams: [
    [1, 1], [2, 1]  // a < b
  ],
  foreign: {
    generator: 'Bates',
    params: s => [3, Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.rangeMin(), Param.rangeMax()]
  }]
}, {
  name: 'BaldingNichols',
  invalidParams: [
    [-1, 0.5], [0, 0.5], [1, 0.5], [2, 0.5],  // 0 < F < 1
    [0.5, -1], [0.5, 0], [0.5, 1], [0.5, 2]   // 0 < p < 1
  ],
  foreign: {
    generator: 'Bates',
    params: () => [3, 0, 1]
  },
  cases: [{
    params: () => [Param.prob(), Param.prob()]
  }]
}, {
  name: 'Bates',
  invalidParams: [
    [-1, 0, 1], [0, 0, 1],    // n > 0
    [10, 1, 1], [10, 2, 1]    // a < b
  ],
  foreign: {
    generator: 'UniformProduct',
    params: () => [2]
  },
  cases: [{
    params: () => [Param.count(), Param.rangeMin(), Param.rangeMax()]
  }]
}, {
  name: 'Benini',
  invalidParams: [
    [-1, 1, 1], [0, 1, 1],  // alpha > 0
    [1, -1, 1], [1, 0, 1],  // beta > 0
    [1, 1, -1], [1, 1, 0]   // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.shape(), Param.shape(), Param.scale()]
  }]
}, {
  name: 'BenktanderII',
  invalidParams: [
    [-1, 0.5], [0, 0.5],      // a > 0
    [1, -1], [1, 0], [1, 1.5] // 0 < b <= 1
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'high shape parameter',
    params: () => [Param.scale(), 1 - Param.prob() / 1000]
  }, {
    name: 'unit shape parameter',
    params: () => [Param.scale(), 1]
  }, {
    name: 'normal shape parameter',
    params: () => [Param.scale(), Math.min(0.9, Param.prob())]
  }]
}, {
  name: 'Bernoulli',
  invalidParams: [
    [-1], [2] // 0 <= p <= 1
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: () => [0, 5]
  },
  cases: [{
    params: () => [Param.prob()]
  }]
}, {
  name: 'Beta',
  invalidParams: [
    [-1, 2], [0, 2], // alpha > 0
    [2, -1], [2, 0]  // beta > 0
  ],
  foreign: {
    generator: 'UniformProduct',
    params: () => [3]
  },
  cases: [{
    params: () => [Param.shape(), Param.shape()]
  }]
}, {
  name: 'BetaBinomial',
  invalidParams: [
    [-1, 1, 1],                 // n > 0
    [100, -1, 1], [100, 0, 1],  // alpha > 0
    [100, 1, -1], [100, 1, 0]   // beta > 0
  ],
  foreign: {
    generator: 'Bates',
    params: s => [3, Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.degree() * 5, Param.shape(), Param.shape()]
  }]
}, {
  name: 'BetaPrime',
  invalidParams: [
    [-1, 2], [0, 2], // alpha > 0
    [2, -1], [2, 0]  // beta > 0
  ],
  foreign: {
    generator: 'Bates',
    params: s => [3, 0, Math.max(...s)]
  },
  cases: [{
    params: () => [Param.shape(), Param.shape()]
  }]
}, {
  name: 'BetaRectangular',
  invalidParams: [
    [1, 1, -1, 0, 1], [1, 1, 2, 0, 1],    // 0 <= theta <= 1
    [1, 1, 0.5, 1, 1], [1, 1, 0.5, 2, 1], // a < b
  ],
  foreign: {
    generator: 'Bates',
    params: () => [3, 0, 1]
  },
  cases: [{
    params: () => [Param.shape(), Param.shape(), Param.prob(), Param.rangeMin(), Param.rangeMax()]
  }]
}, {
  name: 'Binomial',
  invalidParams: [
    [-1, 0.5],            // n >= 0
    [100, -1], [100, 2],  // 0 <= p <= 1
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.rangeMax(), Param.prob()],
  }]
}, {
  name: 'BirnbaumSaunders',
  invalidParams: [
    [0, -1, 1], [0, 0, 1],  // beta > 0
    [0, 1, -1], [0, 1, 0],  // gamma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.location(), Param.scale(), Param.shape()]
  }]
}, {
  name: 'Borel',
  invalidParams: [
    [-1], [2] // 0 <= mu <= 1
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.min(...s) < Math.max(...s) ? Math.max(...s) : Math.min(...s) + 1]
  },
  cases: [{
    name: 'zero parameter',
    params: () => [0]
  }, {
    name: 'positive parameter',
    params: () => [Param.prob()]
  }]
}, {
  name: 'BorelTanner',
  invalidParams: [
    [-1, 2], [2, 2],    // 0 <= mu <= 1
    [0.5, -1], [0.5, 0] // k > 0
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.min(...s) < Math.max(...s) ? Math.max(...s) : Math.min(...s) + 1]
  },
  cases: [{
    name: 'zero parameter',
    params: () => [0, Param.degree()]
  }, {
    name: 'positive parameter',
    params: () => [Param.prob(), Param.degree()]
  }]
}, {
  name: 'BoundedPareto',
  invalidParams: [
    [-1, 10, 1], [0, 10, 1],  // L > 0
    [1, -1, 1], [1, 0, 1],    // H > 0
    [10, 10, 1], [12, 10, 1], // L < H
    [1, 10, -1], [1, 10, 0],  // alpha > 0
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.rangeMin(), Param.rangeMax(), Param.shape()]
  }]
}, {
  name: 'Bradford',
  invalidParams: [
    [-1], [0] // c > 0
  ],
  foreign: {
    generator: 'Bates',
    params: () => [3, 0, 1]
  },
  cases: [{
    params: () => [Param.shape()]
  }]
}, {
  name: 'Burr',
  invalidParams: [
    [-1, 1], [0, 1], // c > 0
    [1, -1], [1, 0], // k > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.shape(), Param.shape()]
  }]
}, {
  name: 'Categorical',
  invalidParams: [
    [[-1, 1, 1], 0],  // w_i > 0
  ],
  foreign: {
    generator: 'Bates',
    params: s => () => [3, Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'small n',
    params: () => [Array.from({length: int(0, 1)}, Math.random)]
  }, {
    name: 'moderate n',
    params: () => [Array.from({ length: int(10, 100) }, Math.random)]
  }, {
    name: 'large n',
    params: () => [Array.from({ length: int(101, 120) }, Math.random)]
  }],
}, {
  name: 'Cauchy',
  invalidParams: [
    [0, -1], [0, 0]  // gamma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.location(), Param.scale()]
  }]
}, {
  name: 'Chi',
  invalidParams: [
    [-1], [0] // k > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'k = 1',
    params: () => [1],
  }, {
    name: 'k > 1',
    params: () => [Param.degree()]
  }],
}, {
  name: 'Chi2',
  invalidParams: [
    [-1], [0] // k > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.degree()]
  }]
}, {
  name: 'Dagum',
  invalidParams: [
    [-1, 1, 1], [0, 1, 1],  // p > 0
    [1, -1, 1], [1, 0, 1],  // a > 0
    [1, 1, -1], [1, 1, 0]   // b > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.shape(), Param.shape(), Param.scale()]
  }]
}, {
  name: 'Delaporte',
  invalidParams: [
    [-1, 1, 1], [0, 1, 1],  // alpha > 0
    [1, -1, 1], [1, 0, 1],  // beta > 0
    [1, 1, -1], [1, 1, 0]   // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.scale(), Param.shape(), Param.shape()]
  }]
}, {
  name: 'DiscreteUniform',
  invalidParams: [
    [105, 100]  // xmin <= xmax
  ],
  foreign: {
    generator: 'Poisson',
    params: s => [s.reduce((sum, d) => d + sum, 0) / s.length]
  },
  cases: [{
    params: () => [int(10), int(11, 100)]
  }]
}, {
  name: 'DiscreteWeibull',
  invalidParams: [
    [-1, 1], [0, 1], [1, 1], [2, 1],  // 0 < q < 1
    [0.5, -1], [0.5, 0]               // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.prob(), Param.shape()]
  }]
}, {
  name: 'DoubleGamma',
  invalidParams: [
    [-1, 1], [0, 1],  // alpha > 0
    [1, -1], [1, 0]   // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.shape(), Param.rate()]
  }]
}, {
  name: 'DoubleWeibull',
  invalidParams: [
    [-1, 1], [0, 1],  // lambda > 0
    [1, -1], [1, 0]   // k > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.scale(), Param.shape()]
  }]
}, {
  name: 'DoublyNoncentralBeta',
  invalidParams: [
    [-1, 1, 1, 1], [0, 1, 1, 1],  // alpha > 0
    [1, -1, 1, 1], [1, 0, 1, 1],  // beta > 0
    [1, 1, -1, 1],                // lambda1 >= 0
    [1, 1, 1, -1]                 // lambda2 >= 0
  ],
  foreign: {
    generator: 'Poisson',
    params: s => [s.reduce((sum, d) => d + sum, 0) / s.length]
  },
  cases: [{
    params: () => [Param.shape(), Param.shape(), Param.shape(), Param.shape()]
  }]
}, {
  name: 'DoublyNoncentralF',
  invalidParams: [
    [-1, 2, 1, 1], [0, 2, 1, 1],  // n1 > 0
    [2, -1, 1, 1], [2, 0, 1, 1],  // n2 > 0
    [2, 2, -1, 1],                // lambda1 >= 0
    [2, 2, 1, -1],                // lambda2 >= 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.degree(), Param.degree(), Param.scale(), Param.scale()]
  }]
}, {
  name: 'DoublyNoncentralT',
  invalidParams: [
    [-1, 1, 1], [0, 1, 1],  // nu > 0
    [1, 1, -1]              // theta >= 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.degree(), Param.location(), Param.shape()]
  }]
}, {
  name: 'Erlang',
  invalidParams: [
    [-1, 1], [0, 1], // k > 0
    [1, -1], [1, 0]  // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.degree(), Param.rate()]
  }]
}, {
  name: 'Exponential',
  invalidParams: [
    [-1], [0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.rate()]
  }]
}, {
  name: 'ExponentialLogarithmic',
  invalidParams: [
    [-1, 1], [0, 1], [1, 1], [2, 1],  // 0 < p < 1
    [0.5, -1], [0.5, 0]               // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.prob(), Param.scale()]
  }]
}, {
  name: 'F',
  invalidParams: [
    [-1, 2], [0, 2],  // d1 > 0
    [2, -1], [2, 0]   // d2 > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.degree(), Param.degree()]
  }]
}, {
  name: 'FisherZ',
  invalidParams: [
    [-1, 2], [0, 2],  // d1 > 0
    [2, -1], [2, 0]   // d2 > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.degree(), Param.degree()]
  }]
}, {
  name: 'FlorySchulz',
  invalidParams: [
    [-1], [0], [1], [2] // 0 < a < 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.prob()]
  }]
}, {
  name: 'Frechet',
  invalidParams: [
    [-1, 1, 0], [0, 1, 0],  // alpha > 0
    [1, -1, 0], [1, 0, 0]   // s > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.shape(), Param.scale(), Param.location()]
  }]
}, {
  name: 'Gamma',
  invalidParams: [
    [-1, 1], [0, 1],  // alpha > 0
    [1, -1], [1, 0]   // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.shape(), Param.rate()]
  }]
}, {
  name: 'GammaGompertz',
  invalidParams: [
    [-1, 1, 1], [0, 1, 1],  // b > 0
    [1, -1, 1], [1, 0, 1],  // s > 0
    [1, 1, -1], [1, 1, 0]   // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.scale(), Param.shape(), Param.shape()]
  }]
}, {
  name: 'GeneralizedExponential',
  invalidParams: [
    [-1, 1, 1], [0, 1, 1],  // a > 0
    [1, -1, 1], [1, 0, 1],  // b > 0
    [1, 1, -1], [1, 1, 0]   // c > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.shape(), Param.shape(), Param.shape()]
  }]
}, {
  name: 'GeneralizedExtremeValue',
  invalidParams: [
    [0] // c != 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'positive shape parameter',
    params: () => [Param.shape()]
  }, {
    name: 'negative shape parameter',
    params: () => [-Param.shape()]
  }]
}, {
  name: 'GeneralizedGamma',
  invalidParams: [
    [-1, 1, 1], [0, 1, 1],  // a > 0
    [1, -1, 1], [1, 0, 1],  // d > 0
    [1, 1, -1], [1, 1, 0]   // p > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.scale(), Param.shape(), Param.shape()]
  }]
}, {
  name: 'GeneralizedHermite',
  invalidParams: [
    [-1, 1, 2],                       // a1 > 0
    [1, -1, 2],                       // a2 > 0
    [1, 1, -1], [1, 1, 0], [1, 1, 1]  // m > 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.rate(), Param.rate(), Param.degree() + 1]
  }]
}, {
  name: 'GeneralizedLogistic',
  invalidParams: [
    [0, -1, 1], [0, 0, 1],  // s > 0
    [0, 1, -1], [0, 1, 0]   // c > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.location(), Param.scale(), Param.shape()]
  }]
}, {
  name: 'GeneralizedNormal',
  invalidParams: [
    [0, -1, 1], [0, 0, 1],  // alpha > 0
    [0, 1, -1], [0, 1, 0]   // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.location(), Param.scale(), Param.shape()]
  }]
}, {
  name: 'GeneralizedPareto',
  invalidParams: [
    [0, -1, 1], [0, 0, 1] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'positive shape parameter',
    params: () => [Param.location(), Param.scale(), Param.shape()]
  }, {
    name: 'negative shape parameter',
    params: () => [Param.location(), Param.scale(), -Param.shape()]
  }, {
    name: 'zero shape parameter',
    params: () => [Param.location(), Param.scale(), 0]
  }]
}, {
  name: 'Geometric',
  invalidParams: [
    [-1], [0], [2]  // 0 < p <= 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.prob()]
  }]
}, {
  name: 'Gilbrat',
  invalidParams: [],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => []
  }]
}, {
  name: 'Gompertz',
  invalidParams: [
    [-1, 1], [0, 1],  // eta > 0
    [1, -1], [1, 0]   // b > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.shape(), Param.scale()]
  }]
}, {
  name: 'Gumbel',
  invalidParams: [
    [0, -1], [0, 0] // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [Param.location(), Param.scale()]
  }]
}, {
  name: 'IrwinHall',
  invalidParams: [
    [-1], [0] // n > 0
  ],
  foreign: {
    generator: 'RaisedCosine',
    params: s => [0, Math.max(...s)]
  },
  cases: [{
    params: () => [Param.count()]
  }]
}]
