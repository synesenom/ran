export default [{
  name: 'Alpha',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // alpha > 0
    [1, -1], [1, 0] // beta > 0
  ],
  foreign: {
    generator: 'Pareto',
    params: () => [2, 2]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Anglit',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // beta > 0
  ],
  foreign: {
    generator: 'Arcsine',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Arcsine',
  invalidParams: [
    [], // all params required
    [1, 1], [2, 1] // a < b
  ],
  foreign: {
    generator: 'Bates',
    params: s => [3, Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 25]
  }]
}, {
  name: 'BaldingNichols',
  invalidParams: [
    [], // all params required
    [-1, 0.5], [0, 0.5], [1, 0.5], [2, 0.5], // 0 < F < 1
    [0.5, -1], [0.5, 0], [0.5, 1], [0.5, 2] // 0 < p < 1
  ],
  foreign: {
    generator: 'Bates',
    params: () => [3, 0, 1]
  },
  cases: [{
    params: () => [0.5, 0.5]
  }]
}, {
  name: 'Bates',
  invalidParams: [
    [], // all params required
    [-1, 0, 1], [0, 0, 1], // n > 0
    [10, 1, 1], [10, 2, 1] // a < b
  ],
  foreign: {
    generator: 'UniformProduct',
    params: () => [2]
  },
  cases: [{
    params: () => [10, 5, 25]
  }]
}, {
  name: 'Benini',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], [0, 1, 1], // alpha > 0
    [1, -1, 1], [1, 0, 1], // beta > 0
    [1, 1, -1], [1, 1, 0] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'BenktanderII',
  invalidParams: [
    [], // all params required
    [-1, 0.5], [0, 0.5], // a > 0
    [1, -1], [1, 0], [1, 1.5] // 0 < b <= 1
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'high shape parameter',
    params: () => [2, 0.9995]
  }, {
    name: 'unit shape parameter',
    params: () => [2, 1]
  }, {
    name: 'normal shape parameter',
    params: () => [2, 0.5]
  }]
}, {
  name: 'Bernoulli',
  invalidParams: [
    [], // all params required
    [-1], [2] // 0 <= p <= 1
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: () => [0, 5]
  },
  cases: [{
    params: () => [0.5]
  }]
}, {
  name: 'Beta',
  invalidParams: [
    [], // all params required
    [-1, 2], [0, 2], // alpha > 0
    [2, -1], [2, 0] // beta > 0
  ],
  foreign: {
    generator: 'UniformProduct',
    params: () => [3]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'BetaBinomial',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], // n > 0
    [100, -1, 1], [100, 0, 1], // alpha > 0
    [100, 1, -1], [100, 1, 0] // beta > 0
  ],
  foreign: {
    generator: 'Bates',
    params: s => [3, Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [25, 2, 2]
  }]
}, /*, {
  name: 'BetaGeometric',
  invalidParams: [
    [], // all params required
    [-1, 1],                    // alpha < 0
    [1,  -1]                    // beta < 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
} */ {
  name: 'BetaPrime',
  invalidParams: [
    [], // all params required
    [-1, 2], [0, 2], // alpha > 0
    [2, -1], [2, 0] // beta > 0
  ],
  foreign: {
    generator: 'Bates',
    params: s => [3, 0, Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'BetaRectangular',
  invalidParams: [
    [], // all params required
    [1, 1, -1, 0, 1], [1, 1, 2, 0, 1], // 0 <= theta <= 1
    [1, 1, 0.5, 1, 1], [1, 1, 0.5, 2, 1] // a < b
  ],
  foreign: {
    generator: 'Bates',
    params: () => [3, 0, 1]
  },
  cases: [{
    params: () => [2, 2, 0.5, 5, 25]
  }]
}, {
  name: 'Binomial',
  invalidParams: [
    [], // all params required
    [-1, 0.5], // n >= 0
    [100, -1], [100, 2] // 0 <= p <= 1
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [25, 0.5]
  }]
}, {
  name: 'BirnbaumSaunders',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1], // beta > 0
    [0, 1, -1], [0, 1, 0] // gamma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2, 2]
  }]
}, {
  name: 'Borel',
  invalidParams: [
    [], // all params required
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
    params: () => [0.5]
  }]
}, {
  name: 'BorelTanner',
  invalidParams: [
    [], // all params required
    [-1, 2], [2, 2], // 0 <= mu <= 1
    [0.5, -1], [0.5, 0] // k > 0
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.min(...s) < Math.max(...s) ? Math.max(...s) : Math.min(...s) + 1]
  },
  cases: [{
    name: 'zero parameter',
    params: () => [0, 5]
  }, {
    name: 'positive parameter',
    params: () => [0.5, 5]
  }]
}, {
  name: 'BoundedPareto',
  invalidParams: [
    [], // all params required
    [-1, 10, 1], [0, 10, 1], // L > 0
    [1, -1, 1], [1, 0, 1], // H > 0
    [10, 10, 1], [12, 10, 1], // L < H
    [1, 10, -1], [1, 10, 0] // alpha > 0
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 25, 2]
  }]
}, {
  name: 'Bradford',
  invalidParams: [
    [], // all params required
    [-1], [0] // c > 0
  ],
  foreign: {
    generator: 'Bates',
    params: () => [3, 0, 1]
  },
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'Burr',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // c > 0
    [1, -1], [1, 0] // k > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Categorical',
  invalidParams: [
    [], // all params required
    [[-1, 1, 1], 0] // w_i > 0
  ],
  foreign: {
    generator: 'Bates',
    params: s => [3, Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'small n',
    params: () => [[0.4, 0.6], 0]
  }, {
    name: 'moderate n',
    params: () => [[0.1, 0.05, 0.15, 0.08, 0.12, 0.1, 0.07, 0.13, 0.09, 0.11], 0]
  }, {
    name: 'large n',
    params: () => [Array.from({ length: 105 }, () => 1 / 105), 0]
  }]
}, {
  name: 'Cauchy',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // gamma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Chi',
  invalidParams: [
    [], // all params required
    [-1], [0] // k > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'k = 1',
    params: () => [1]
  }, {
    name: 'k > 1',
    params: () => [5]
  }]
}, {
  name: 'Chi2',
  invalidParams: [
    [], // all params required
    [-1], [0] // k > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5]
  }]
}, {
  name: 'Dagum',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], [0, 1, 1], // p > 0
    [1, -1, 1], [1, 0, 1], // a > 0
    [1, 1, -1], [1, 1, 0] // b > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
}, /*, {
  name: 'Davis',
  invalidParams: [
    [], // all params required
    [-1, 1, 1.5], [0, 1, 1.5],  // mu > 0
    [1, -1, 1.5], [1, 0, 1.5],  // b > 0
    [1, 1, -1], [1, 1, 0],      // n > 0
    [1, 1, 1]                   // n != 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
} */ {
  name: 'Delaporte',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], [0, 1, 1], // alpha > 0
    [1, -1, 1], [1, 0, 1], // beta > 0
    [1, 1, -1], [1, 1, 0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'DiscreteUniform',
  invalidParams: [
    [], // all params required
    [105, 100] // xmin <= xmax
  ],
  foreign: {
    generator: 'Poisson',
    params: s => [s.reduce((sum, d) => d + sum, 0) / s.length]
  },
  cases: [{
    params: () => [5, 50]
  }]
}, {
  name: 'DiscreteWeibull',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], [1, 1], [2, 1], // 0 < q < 1
    [0.5, -1], [0.5, 0] // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0.5, 2]
  }]
}, {
  name: 'DoubleGamma',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // alpha > 0
    [1, -1], [1, 0] // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'DoubleWeibull',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // lambda > 0
    [1, -1], [1, 0] // k > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'DoublyNoncentralBeta',
  invalidParams: [
    [], // all params required
    [-1, 1, 1, 1], [0, 1, 1, 1], // alpha > 0
    [1, -1, 1, 1], [1, 0, 1, 1], // beta > 0
    [1, 1, -1, 1], // lambda1 >= 0
    [1, 1, 1, -1] // lambda2 >= 0
  ],
  foreign: {
    generator: 'Poisson',
    params: s => [s.reduce((sum, d) => d + sum, 0) / s.length]
  },
  cases: [{
    params: () => [2, 2, 2, 2]
  }]
}, {
  name: 'DoublyNoncentralF',
  invalidParams: [
    [], // all params required
    [-1, 2, 1, 1], [0, 2, 1, 1], // n1 > 0
    [2, -1, 1, 1], [2, 0, 1, 1], // n2 > 0
    [2, 2, -1, 1], // lambda1 >= 0
    [2, 2, 1, -1] // lambda2 >= 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 5, 2, 2]
  }]
}, {
  name: 'DoublyNoncentralT',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], [0, 1, 1], // nu > 0
    [1, 1, -1] // theta >= 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 1, 2]
  }, {
    params: () => [5, 0, 2]
  }]
}, {
  name: 'Erlang',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // k > 0
    [1, -1], [1, 0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 2]
  }]
}, {
  name: 'Exponential',
  invalidParams: [
    [], // all params required
    [-1], [0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'ExponentialLogarithmic',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], [1, 1], [2, 1], // 0 < p < 1
    [0.5, -1], [0.5, 0] // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0.5, 2]
  }]
}, {
  name: 'ExponentiatedWeibull',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], [0, 1, 1], // lambda > 0
    [1, -1, 1], [1, 0, 1], // k > 0
    [1, 1, -1], [1, 1, 0] // alpha > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'F',
  invalidParams: [
    [], // all params required
    [-1, 2], [0, 2], // d1 > 0
    [2, -1], [2, 0] // d2 > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 5]
  }]
}, {
  name: 'FisherZ',
  invalidParams: [
    [], // all params required
    [-1, 2], [0, 2], // d1 > 0
    [2, -1], [2, 0] // d2 > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 5]
  }, {
    name: 'low degrees of freedom',
    params: () => [1, 1]
  }]
}, {
  name: 'FlorySchulz',
  invalidParams: [
    [], // all params required
    [-1], [0], [1], [2] // 0 < a < 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0.5]
  }]
}, {
  name: 'Frechet',
  invalidParams: [
    [], // all params required
    [-1, 1, 0], [0, 1, 0], // alpha > 0
    [1, -1, 0], [1, 0, 0] // s > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 0]
  }]
}, {
  name: 'Gamma',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // alpha > 0
    [1, -1], [1, 0] // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'GammaGompertz',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], [0, 1, 1], // b > 0
    [1, -1, 1], [1, 0, 1], // s > 0
    [1, 1, -1], [1, 1, 0] // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'GeneralizedExponential',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], [0, 1, 1], // a > 0
    [1, -1, 1], [1, 0, 1], // b > 0
    [1, 1, -1], [1, 1, 0] // c > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'GeneralizedExtremeValue',
  invalidParams: [
    [], // all params required
    [0] // c != 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'positive shape parameter',
    params: () => [2]
  }, {
    name: 'negative shape parameter',
    params: () => [-2]
  }]
}, {
  name: 'GeneralizedGamma',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], [0, 1, 1], // a > 0
    [1, -1, 1], [1, 0, 1], // d > 0
    [1, 1, -1], [1, 1, 0] // p > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'GeneralizedHermite',
  invalidParams: [
    [], // all params required
    [-1, 1, 2], // a1 > 0
    [1, -1, 2], // a2 > 0
    [1, 1, -1], [1, 1, 0], [1, 1, 1] // m > 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 6]
  }]
}, {
  name: 'GeneralizedLogistic',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1], // s > 0
    [0, 1, -1], [0, 1, 0] // c > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2, 2]
  }]
}, {
  name: 'GeneralizedNormal',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1], // alpha > 0
    [0, 1, -1], [0, 1, 0] // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2, 2]
  }]
}, {
  name: 'GeneralizedPareto',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'positive shape parameter',
    params: () => [0, 2, 2]
  }, {
    name: 'negative shape parameter',
    params: () => [0, 2, -2]
  }, {
    name: 'zero shape parameter',
    params: () => [0, 2, 0]
  }]
}, {
  name: 'Geometric',
  invalidParams: [
    [], // all params required
    [-1], [0], [2] // 0 < p <= 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0.5]
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
    [], // all params required
    [-1, 1], [0, 1], // eta > 0
    [1, -1], [1, 0] // b > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Gumbel',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'HalfGeneralizedNormal',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // alpha > 0
    [1, -1], [1, 0] // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'HalfLogistic',
  invalidParams: [],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => []
  }]
}, {
  name: 'HalfNormal',
  invalidParams: [
    [], // all params required
    [-1], [0] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'HeadsMinusTails',
  invalidParams: [
    [], // all params required
    [-1] // n > 0
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5]
  }]
}, {
  name: 'Hoyt',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], [2, 1], // 0 < q <= 1
    [0.5, -1], [0.5, 0] // omega > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'q < 0.5',
    params: () => [0.25, 2]
  }, {
    name: 'normal q',
    params: () => [0.5, 2]
  }]
}, {
  name: 'HyperbolicSecant',
  invalidParams: [],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => []
  }]
}, {
  name: 'Hyperexponential',
  invalidParams: [
    [], // all params required
    [{ weight: -1, rate: 1 }, { weight: 1, rate: 1 }],
    [{ weight: 0, rate: 1 }, { weight: 1, rate: 1 }], // lambda_i > 0
    [[]] // n > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [[{ weight: 2, rate: 2 }, { weight: 2, rate: 2 }, { weight: 2, rate: 2 }, { weight: 2, rate: 2 }, { weight: 2, rate: 2 }, { weight: 2, rate: 2 }]]
  }]
}, {
  name: 'Hypergeometric',
  invalidParams: [
    [], // all params required
    [-1, 5, 5], [0, 5, 5], // N > 0
    [10, -1, 5], [10, 12, 5], // 0 <= K <= N
    [10, 5, -1], [10, 5, 12] // 0 <= n <= N
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [30, 10, 5]
  }]
}, {
  name: 'InverseChi2',
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  invalidParams: [
    [], // all params required
    [-1], [0] // nu > 0
  ],
  cases: [{
    params: () => [6]
  }]
}, {
  name: 'InverseGamma',
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // alpha > 0
    [1, -1], [1, 0] // beta > 0
  ],
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'InverseGaussian',
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // mu > 0
    [1, -1], [1, 0] // lambda > 0
  ],
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'InvertedWeibull',
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  invalidParams: [
    [], // all params required
    [-1], [0] // c > 0
  ],
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'IrwinHall',
  invalidParams: [
    [], // all params required
    [-1], [0] // n > 0
  ],
  foreign: {
    generator: 'UniformProduct',
    params: () => [2]
  },
  cases: [{
    params: () => [10]
  }]
}, {
  name: 'JohnsonSU',
  invalidParams: [
    [], // all params required
    [0, -1, 1, 0], [0, 0, 1, 0], // delta > 0
    [0, 1, -1, 0], [0, 1, 0, 0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2, 2, 0]
  }]
}, {
  name: 'JohnsonSB',
  invalidParams: [
    [], // all params required
    [0, -1, 1, 0], [0, 0, 1, 0], // delta > 0
    [0, 1, -1, 0], [0, 1, 0, 0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2, 2, 0]
  }]
}, {
  name: 'Kolmogorov',
  invalidParams: [],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => []
  }]
}, {
  name: 'Kumaraswamy',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // a > 0
    [1, -1], [1, 0] // b > 0
  ],
  foreign: {
    generator: 'RaisedCosine',
    params: () => [0, 1]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Laplace',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // b > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Levy',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // c > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Lindley',
  invalidParams: [
    [], // all params required
    [-1], [0] // theta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'LogCauchy',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'LogGamma',
  invalidParams: [
    [], // all params required
    [-1, 1, 0], [0, 1, 0], // alpha > 0
    [1, -1, 0], [1, 0, 0], // beta > 0
    [1, 1, -1] // mu >= 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'LogLaplace',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // b > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'LogLogistic',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // alpha > 0
    [1, -1], [1, 0] // beta > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'LogNormal',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'LogSeries',
  invalidParams: [
    [], // all params required
    [-1], [0], [1], [2] // 0 < p < 1
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0.5]
  }]
}, {
  name: 'Logarithmic',
  invalidParams: [
    [], // all params required
    [-1, 2], [0, 2], // a >= 1
    [1, -1], [1, 0], // b >= 1
    [2, 2], [3, 2] // a < b
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [6, 30]
  }]
}, {
  name: 'Logistic',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // s > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'LogisticExponential',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // lambda > 0
    [1, -1], [1, 0] // kappa > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'LogitNormal',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Lomax',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // lambda > 0
    [1, -1], [1, 0] // alpha > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Makeham',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], [0, 1, 1], // alpha > 0
    [1, -1, 1], [1, 0, 1], // beta > 0
    [1, 1, -1], [1, 1, 0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'MaxwellBoltzmann',
  invalidParams: [
    [], // all params required
    [-1], [0] // a > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'Mielke',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // k > 0
    [2, -1], [2, 0] // s > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Moyal',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Muth',
  invalidParams: [
    [], // all params required
    [-1], [0], [2] // 0 < alpha <= 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0.5]
  }]
}, {
  name: 'Nakagami',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], [0.3, 1], // m >= 0.5
    [1, -1], [1, 0] // omega > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2.5, 2]
  }]
}, {
  name: 'NegativeHypergeometric',
  invalidParams: [
    [], // all params required
    [-1, 5, 5], // N >= 0
    [10, -1, 5], [10, 11, 5], // 0 <= K <= N
    [10, 5, -1], [10, 5, 6] // 0 <= r <= K - N
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [35, 15, 7]
  }]
}, {
  name: 'NegativeBinomial',
  invalidParams: [
    [], // all params required
    [-1, 0.5], [0, 0.5], // r > 0
    [10, -1], [10, 2] // 0 <= p <= 1
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [10, 0.5]
  }]
}, {
  name: 'NeymanA',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // lambda > 0
    [1, -1], [1, 0] // mu > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'NoncentralBeta',
  invalidParams: [
    [], // all params required
    [-1, 2, 1], [0, 2, 1], // alpha > 0
    [2, -1, 1], [2, 0, 1], // beta > 0
    [2, 2, -1] // lambda >= 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'NoncentralChi',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // k > 0
    [2, -1], [2, 0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 2]
  }]
}, {
  name: 'NoncentralChi2',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // k > 0
    [2, -1], [2, 0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'odd k',
    params: () => [11, 2]
  }, {
    name: 'even k',
    params: () => [10, 2]
  }]
}, {
  name: 'NoncentralF',
  invalidParams: [
    [], // all params required
    [-1, 2, 1], [0, 2, 1], // alpha > 0
    [2, -1, 1], [2, 0, 1], // beta > 0
    [2, 2, -1] // lambda >= 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 5, 2]
  }]
}, {
  name: 'NoncentralT',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1] // nu > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 0]
  }]
}, {
  name: 'Normal',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Pareto',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // xmin > 0
    [1, -1], [1, 0] // alpha > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'PERT',
  invalidParams: [
    [], // all params required
    [0.5, 0.5, 1], [0.8, 0.5, 1], // a < b
    [0, 1, 1], [0, 1.1, 1] // b < c
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 15, 25]
  }]
}, {
  name: 'Poisson',
  invalidParams: [
    [], // all params required
    [-1], [0] // lambda > 0
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'low mean',
    params: () => [10]
  }, {
    name: 'high mean',
    params: () => [40]
  }]
}, {
  name: 'PolyaAeppli',
  invalidParams: [
    [], // all params required
    [-1, 0.5], [0, 0.5], // lambda > 0
    [1, -1], [1, 0], [1, 1], [1, 2] // 0 < theta < 1
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 0.5]
  }]
}, {
  name: 'PowerLaw',
  invalidParams: [
    [], // all params required
    [-1], [0] // a > 0
  ],
  foreign: {
    generator: 'Poisson',
    params: s => [s.reduce((sum, d) => d + sum, 0) / s.length]
  },
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'QExponential',
  invalidParams: [
    [], // all params required
    [2, 1], [3, 1], // q < 2
    [1.5, -1], [1.5, 0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'R',
  invalidParams: [
    [], // all params required
    [-1], [0] // c > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    // c=4 instead of 2 — at c=2 the sample distribution is too uniform-shaped
    // for the foreign-rejection test (vs Uniform) to reject reliably
    params: () => [4]
  }]
}, {
  name: 'Rademacher',
  invalidParams: [],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => []
  }]
}, {
  name: 'RaisedCosine',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // s > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Rayleigh',
  invalidParams: [
    [], // all params required
    [-1], [0] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'Reciprocal',
  invalidParams: [
    [], // all params required
    [-1, 2], [0, 2], // a > 0
    [1, -1], [1, 0], // b > 0
    [2, 2], [3, 2] // a < b
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 25]
  }]
}, {
  name: 'ReciprocalInverseGaussian',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // mu > 0
    [1, -1], [1, 0] // lambda > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Rice',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // nu > 0
    [1, -1], [1, 0] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'ShiftedLogLogistic',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1] // sigma > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'positive shape parameter',
    params: () => [0, 2, 2]
  }, {
    name: 'negative shape parameter',
    params: () => [0, 2, -2]
  }, {
    name: 'zero shape parameter',
    params: () => [0, 2, 0]
  }]
}, {
  name: 'Skellam',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // mu1 > 0
    [1, -1], [1, 0] // mu2 > 0
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 5]
  }]
}, {
  name: 'SkewNormal',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1] // omega > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'positive shape parameter',
    params: () => [0, 2, 2]
  }, {
    name: 'negative shape parameter',
    params: () => [0, 2, -2]
  }, {
    name: 'zero shape parameter',
    params: () => [0, 2, 0]
  }]
}, {
  name: 'Slash',
  invalidParams: [],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => []
  }]
}, {
  name: 'Soliton',
  invalidParams: [
    [], // all params required
    [-1], [0] // N > 0
  ],
  foreign: {
    generator: 'DiscreteUniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [10]
  }]
}, {
  name: 'StudentT',
  invalidParams: [
    [], // all params required
    [-1], [0] // nu > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'StudentZ',
  invalidParams: [
    [], // all params required
    [-1], [0], [1] // n > 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [3]
  }]
}, {
  name: 'Trapezoidal',
  invalidParams: [
    [], // all params required
    [1, 0.33, 0.67, 1], [2, 0.33, 0.67, 1], // a < d
    [1, 0.33, 0.67, 1], [0, 0.67, 0.67, 1], [0, 0.8, 0.67, 1], // a <= b < c
    [0, 0.33, 2, 1] // c <= d
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [-3, -1, 1, 3]
  }]
}, {
  name: 'Triangular',
  invalidParams: [
    [], // all params required
    [1, 1, 0.5], [2, 1, 0.5], // a < b
    [0, 1, -1], [0, 1, 2] // a <= c <= b
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 25, 15]
  }]
}, {
  name: 'TruncatedNormal',
  invalidParams: [
    [], // all params required
    [0, -1, 0, 1], [0, 0, 0, 1], // sigma > 0
    [0, 1, 0, 0], [0, 1, 1, 0] // b > a
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    // mu must lie within [a, b] so the truncated PDF isn't near-flat
    params: () => [2.5, 2, 0, 5]
  }]
}, {
  name: 'TukeyLambda',
  invalidParams: [
    [] // all params required
  ],
  foreign: {
    generator: 'Bates',
    params: s => [3, Math.min(...s), Math.max(...s)]
  },
  cases: [{
    name: 'zero shape parameter',
    params: () => [0]
  }, {
    name: 'positive shape parameter',
    params: () => [2]
  }, {
    name: 'negative shape parameter',
    params: () => [-2]
  }]
}, {
  name: 'UQuadratic',
  invalidParams: [
    [], // all params required
    [1, 1], [2, 1] // a < b
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [5, 25]
  }]
}, {
  name: 'Uniform',
  invalidParams: [
    [], // all params required
    [1, 1], [2, 1] // a < b
  ],
  foreign: {
    generator: 'Poisson',
    params: s => [s.reduce((sum, d) => d + sum, 0) / s.length]
  },
  cases: [{
    params: () => [5, 25]
  }]
}, {
  name: 'UniformProduct',
  invalidParams: [
    [], // all params required
    [-1], [0], [1] // n > 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [6]
  }]
}, {
  name: 'UniformRatio',
  invalidParams: [],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => []
  }]
}, {
  name: 'VonMises',
  invalidParams: [
    [], // all params required
    [-1], [0] // kappa > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'Weibull',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // lambda > 0
    [1, -1], [1, 0] // k > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Wigner',
  invalidParams: [
    [], // all params required
    [-1], [0] // R > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'YuleSimon',
  invalidParams: [
    [], // all params required
    [-1], [0] // rho > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [3]
  }]
}, {
  name: 'Zeta',
  invalidParams: [
    [], // all params required
    [-1], [0], [1] // s > 1
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [3.8]
  }]
}, {
  name: 'Zipf',
  invalidParams: [
    [], // all params required
    [-1, 100], // s >= 1
    [1, -1], [1, 0] // N > 0
  ],
  foreign: {
    generator: 'Uniform',
    params: s => [Math.min(...s), Math.max(...s)]
  },
  cases: [{
    params: () => [3, 100]
  }]
}]
