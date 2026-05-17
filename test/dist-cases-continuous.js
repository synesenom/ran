export default [{
  name: 'Alpha',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // alpha > 0
    [1, -1], [1, 0] // beta > 0
  ],
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Anglit',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // beta > 0
  ],
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Arcsine',
  invalidParams: [
    [], // all params required
    [1, 1], [2, 1] // a < b
  ],
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
  name: 'Beta',
  invalidParams: [
    [], // all params required
    [-1, 2], [0, 2], // alpha > 0
    [2, -1], [2, 0] // beta > 0
  ],
  cases: [{
    params: () => [2, 2]
  }],
  refVals: [
    { x: 0.2, pdf: 0.96, cdf: 0.104 },
    { x: 0.4, pdf: 1.44, cdf: 0.352 },
    { x: 0.6, pdf: 1.44, cdf: 0.648 },
    { x: 0.8, pdf: 0.96, cdf: 0.896 }
  ]
}, {
  name: 'BetaPrime',
  invalidParams: [
    [], // all params required
    [-1, 2], [0, 2], // alpha > 0
    [2, -1], [2, 0] // beta > 0
  ],
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
  cases: [{
    params: () => [2, 2, 0.5, 5, 25]
  }]
}, {
  name: 'BirnbaumSaunders',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1], // beta > 0
    [0, 1, -1], [0, 1, 0] // gamma > 0
  ],
  cases: [{
    params: () => [0, 2, 2]
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
  cases: [{
    params: () => [5, 25, 2]
  }]
}, {
  name: 'Bradford',
  invalidParams: [
    [], // all params required
    [-1], [0] // c > 0
  ],
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
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Cauchy',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // gamma > 0
  ],
  cases: [{
    params: () => [0, 2]
  }],
  refVals: [
    { x: -4, pdf: 0.0318309886183791, cdf: 0.147583617650433 },
    { x: 0, pdf: 0.159154943091895, cdf: 0.5 },
    { x: 2, pdf: 0.0795774715459477, cdf: 0.75 },
    { x: 6, pdf: 0.0159154943091895, cdf: 0.897583617650433 }
  ]
}, {
  name: 'Chi',
  invalidParams: [
    [], // all params required
    [-1], [0] // k > 0
  ],
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
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'DoubleGamma',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // alpha > 0
    [1, -1], [1, 0] // beta > 0
  ],
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
  cases: [{
    params: () => [5, 2]
  }]
}, {
  name: 'Exponential',
  invalidParams: [
    [], // all params required
    [-1], [0] // lambda > 0
  ],
  cases: [{
    params: () => [2]
  }],
  refVals: [
    { x: 0.5, pdf: 0.735758882342885, cdf: 0.632120558828558 },
    { x: 1, pdf: 0.270670566473225, cdf: 0.864664716763387 },
    { x: 2, pdf: 0.0366312777774684, cdf: 0.981684361111266 },
    { x: 3, pdf: 0.00495750435333272, cdf: 0.997521247823334 }
  ]
}, {
  name: 'ExponentialLogarithmic',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], [1, 1], [2, 1], // 0 < p < 1
    [0.5, -1], [0.5, 0] // beta > 0
  ],
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
  cases: [{
    params: () => [5, 5]
  }, {
    name: 'low degrees of freedom',
    params: () => [1, 1]
  }]
}, {
  name: 'Frechet',
  invalidParams: [
    [], // all params required
    [-1, 1, 0], [0, 1, 0], // alpha > 0
    [1, -1, 0], [1, 0, 0] // s > 0
  ],
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
  cases: [{
    params: () => [2, 2]
  }],
  refVals: [
    { x: 0.5, pdf: 0.735758882342885, cdf: 0.264241117657115 },
    { x: 1, pdf: 0.541341132946451, cdf: 0.593994150290162 },
    { x: 2, pdf: 0.146525111109873, cdf: 0.908421805556329 },
    { x: 3, pdf: 0.0297450261199963, cdf: 0.982648734763335 }
  ]
}, {
  name: 'GammaGompertz',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], [0, 1, 1], // b > 0
    [1, -1, 1], [1, 0, 1], // s > 0
    [1, 1, -1], [1, 1, 0] // beta > 0
  ],
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
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'GeneralizedExtremeValue',
  invalidParams: [
    [], // all params required
    [0] // c != 0
  ],
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
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'GeneralizedLogistic',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1], // s > 0
    [0, 1, -1], [0, 1, 0] // c > 0
  ],
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
  cases: [{
    params: () => [0, 2, 2]
  }]
}, {
  name: 'GeneralizedPareto',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1] // sigma > 0
  ],
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
  name: 'Gilbrat',
  invalidParams: [],
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
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Gumbel',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // beta > 0
  ],
  cases: [{
    params: () => [0, 2]
  }],
  refVals: [
    { x: -2, pdf: 0.0896870393670086, cdf: 0.0659880358453125 },
    { x: 0, pdf: 0.183939720585721, cdf: 0.367879441171442 },
    { x: 2, pdf: 0.127323190021791, cdf: 0.692200627555346 },
    { x: 5, pdf: 0.0378080899587133, cdf: 0.921193655175516 }
  ]
}, {
  name: 'HalfGeneralizedNormal',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // alpha > 0
    [1, -1], [1, 0] // beta > 0
  ],
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'HalfLogistic',
  invalidParams: [],
  cases: [{
    params: () => []
  }]
}, {
  name: 'HalfNormal',
  invalidParams: [
    [], // all params required
    [-1], [0] // sigma > 0
  ],
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'Hoyt',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], [2, 1], // 0 < q <= 1
    [0.5, -1], [0.5, 0] // omega > 0
  ],
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
  cases: [{
    params: () => [[{ weight: 2, rate: 2 }, { weight: 2, rate: 2 }, { weight: 2, rate: 2 }, { weight: 2, rate: 2 }, { weight: 2, rate: 2 }, { weight: 2, rate: 2 }]]
  }]
}, {
  name: 'InverseChi2',
  invalidParams: [
    [], // all params required
    [-1], [0] // nu > 0
  ],
  cases: [{
    params: () => [6]
  }]
}, {
  name: 'InverseGamma',
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
  cases: [{
    params: () => [0, 2, 2, 0]
  }]
}, {
  name: 'Kolmogorov',
  invalidParams: [],
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
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Laplace',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // b > 0
  ],
  cases: [{
    params: () => [0, 2]
  }],
  refVals: [
    { x: -2, pdf: 0.0919698602928606, cdf: 0.183939720585721 },
    { x: 0, pdf: 0.25, cdf: 0.5 },
    { x: 1, pdf: 0.151632664928158, cdf: 0.696734670143683 },
    { x: 4, pdf: 0.0338338208091532, cdf: 0.932332358381694 }
  ]
}, {
  name: 'Levy',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // c > 0
  ],
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Lindley',
  invalidParams: [
    [], // all params required
    [-1], [0] // theta > 0
  ],
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'LogCauchy',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // sigma > 0
  ],
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
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'LogLaplace',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // b > 0
  ],
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
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'LogNormal',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // sigma > 0
  ],
  cases: [{
    params: () => [0, 2]
  }],
  refVals: [
    { x: 0.5, pdf: 0.375688416016771, cdf: 0.364455844736536 },
    { x: 1, pdf: 0.199471140200716, cdf: 0.5 },
    { x: 2, pdf: 0.0939221040041928, cdf: 0.635544155263464 },
    { x: 5, pdf: 0.0288596767752982, cdf: 0.789509060951237 }
  ]
}, {
  name: 'Logarithmic',
  invalidParams: [
    [], // all params required
    [-1, 2], [0, 2], // a >= 1
    [1, -1], [1, 0], // b >= 1
    [2, 2], [3, 2] // a < b
  ],
  cases: [{
    params: () => [6, 30]
  }]
}, {
  name: 'Logistic',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // s > 0
  ],
  cases: [{
    params: () => [0, 2]
  }],
  refVals: [
    { x: -4, pdf: 0.0524967927017533, cdf: 0.119202922022118 },
    { x: 0, pdf: 0.125, cdf: 0.5 },
    { x: 2, pdf: 0.0983059666207409, cdf: 0.731058578630005 },
    { x: 5, pdf: 0.0350518582725541, cdf: 0.924141819978757 }
  ]
}, {
  name: 'LogisticExponential',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // lambda > 0
    [1, -1], [1, 0] // kappa > 0
  ],
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'LogitNormal',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // sigma > 0
  ],
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
  cases: [{
    params: () => [2, 2, 2]
  }]
}, {
  name: 'MaxwellBoltzmann',
  invalidParams: [
    [], // all params required
    [-1], [0] // a > 0
  ],
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
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Moyal',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // sigma > 0
  ],
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Muth',
  invalidParams: [
    [], // all params required
    [-1], [0], [2] // 0 < alpha <= 1
  ],
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
  cases: [{
    params: () => [2.5, 2]
  }]
}, {
  name: 'NoncentralBeta',
  invalidParams: [
    [], // all params required
    [-1, 2, 1], [0, 2, 1], // alpha > 0
    [2, -1, 1], [2, 0, 1], // beta > 0
    [2, 2, -1] // lambda >= 0
  ],
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
  cases: [{
    params: () => [5, 5, 2]
  }]
}, {
  name: 'NoncentralT',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1] // nu > 0
  ],
  cases: [{
    params: () => [5, 0]
  }]
}, {
  name: 'Normal',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // sigma > 0
  ],
  cases: [{
    params: () => [0, 2]
  }],
  refVals: [
    { x: -2, pdf: 0.120985362259572, cdf: 0.158655253931457 },
    { x: 0, pdf: 0.199471140200716, cdf: 0.5 },
    { x: 1, pdf: 0.17603266338215, cdf: 0.691462461274013 },
    { x: 3, pdf: 0.0647587978329459, cdf: 0.933192798731142 }
  ]
}, {
  name: 'Pareto',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // xmin > 0
    [1, -1], [1, 0] // alpha > 0
  ],
  cases: [{
    params: () => [2, 2]
  }],
  refVals: [
    { x: 2.5, pdf: 0.512, cdf: 0.36 },
    { x: 3, pdf: 0.296296296296296, cdf: 0.555555555555556 },
    { x: 5, pdf: 0.064, cdf: 0.84 },
    { x: 10, pdf: 0.008, cdf: 0.96 }
  ]
}, {
  name: 'PERT',
  invalidParams: [
    [], // all params required
    [0.5, 0.5, 1], [0.8, 0.5, 1], // a < b
    [0, 1, 1], [0, 1.1, 1] // b < c
  ],
  cases: [{
    params: () => [5, 15, 25]
  }]
}, {
  name: 'PowerLaw',
  invalidParams: [
    [], // all params required
    [-1], [0] // a > 0
  ],
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
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'R',
  invalidParams: [
    [], // all params required
    [-1], [0] // c > 0
  ],
  cases: [{
    // c=4 instead of 2 — at c=2 the sample distribution is too uniform-shaped
    // for the foreign-rejection test (vs Uniform) to reject reliably
    params: () => [4]
  }]
}, {
  name: 'RaisedCosine',
  invalidParams: [
    [], // all params required
    [0, -1], [0, 0] // s > 0
  ],
  cases: [{
    params: () => [0, 2]
  }]
}, {
  name: 'Rayleigh',
  invalidParams: [
    [], // all params required
    [-1], [0] // sigma > 0
  ],
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
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'ShiftedLogLogistic',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1] // sigma > 0
  ],
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
  name: 'SkewNormal',
  invalidParams: [
    [], // all params required
    [0, -1, 1], [0, 0, 1] // omega > 0
  ],
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
  cases: [{
    params: () => []
  }]
}, {
  name: 'StudentT',
  invalidParams: [
    [], // all params required
    [-1], [0] // nu > 0
  ],
  cases: [{
    params: () => [2]
  }]
}, {
  name: 'StudentZ',
  invalidParams: [
    [], // all params required
    [-1], [0], [1] // n > 1
  ],
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
    // TukeyLambda(lambda=2) equals Uniform(-0.5,0.5); use Exponential which is clearly wrong for all lambda values
    generator: 'Exponential',
    params: () => [1]
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
    // generic fallback is Uniform(lo, hi) which IS the distribution under test — use Poisson instead
    generator: 'Poisson',
    params: s => [s.reduce((sum, d) => d + sum, 0) / s.length]
  },
  cases: [{
    params: () => [5, 25]
  }],
  refVals: [
    { x: 7, pdf: 0.05, cdf: 0.1 },
    { x: 10, pdf: 0.05, cdf: 0.25 },
    { x: 15, pdf: 0.05, cdf: 0.5 },
    { x: 20, pdf: 0.05, cdf: 0.75 }
  ]
}, {
  name: 'UniformProduct',
  invalidParams: [
    [], // all params required
    [-1], [0], [1] // n > 1
  ],
  cases: [{
    params: () => [6]
  }]
}, {
  name: 'UniformRatio',
  invalidParams: [],
  cases: [{
    params: () => []
  }]
}, {
  name: 'VonMises',
  invalidParams: [
    [], // all params required
    [-1], [0] // kappa > 0
  ],
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
  cases: [{
    params: () => [2, 2]
  }],
  refVals: [
    { x: 0.5, pdf: 0.234853265703369, cdf: 0.0605869371865242 },
    { x: 1, pdf: 0.389400391535702, cdf: 0.221199216928595 },
    { x: 2, pdf: 0.367879441171442, cdf: 0.632120558828558 },
    { x: 3, pdf: 0.158098836842796, cdf: 0.894600775438136 }
  ]
}, {
  name: 'Wigner',
  invalidParams: [
    [], // all params required
    [-1], [0] // R > 0
  ],
  cases: [{
    params: () => [2]
  }]
}]
