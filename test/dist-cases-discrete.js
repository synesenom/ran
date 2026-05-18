export default [{
  name: 'Bernoulli',
  invalidParams: [
    [], // all params required
    [-1], [2] // 0 <= p <= 1
  ],
  foreign: {
    // Bernoulli(0.5) is identical to DiscreteUniform(0,1); use Poisson to avoid self-referential rejection
    generator: 'Poisson',
    params: () => [5]
  },
  cases: [{
    params: () => [0.5]
  }]
}, {
  name: 'BetaBinomial',
  invalidParams: [
    [], // all params required
    [-1, 1, 1], // n > 0
    [100, -1, 1], [100, 0, 1], // alpha > 0
    [100, 1, -1], [100, 1, 0] // beta > 0
  ],
  cases: [{
    params: () => [25, 2, 2]
  }]
}, {
  name: 'Binomial',
  invalidParams: [
    [], // all params required
    [-1, 0.5], // n >= 0
    [100, -1], [100, 2] // 0 <= p <= 1
  ],
  cases: [{
    params: () => [25, 0.5]
  }]
}, {
  name: 'Borel',
  invalidParams: [
    [], // all params required
    [-1], [2] // 0 <= mu <= 1
  ],
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
  cases: [{
    name: 'zero parameter',
    params: () => [0, 5]
  }, {
    name: 'positive parameter',
    params: () => [0.5, 5]
  }]
}, {
  name: 'Categorical',
  invalidParams: [
    [], // all params required
    [[-1, 1, 1], 0] // w_i > 0
  ],
  foreign: {
    // Categorical with uniform weights is identical to DiscreteUniform; use Poisson to avoid self-referential rejection
    generator: 'Poisson',
    params: () => [5]
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
  name: 'Delaporte',
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
  name: 'DiscreteUniform',
  invalidParams: [
    [], // all params required
    [105, 100] // xmin <= xmax
  ],
  foreign: {
    // generic fallback is DiscreteUniform(lo, hi) which IS the distribution under test — use Poisson instead
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
  cases: [{
    params: () => [0.5, 2]
  }]
}, {
  name: 'FlorySchulz',
  invalidParams: [
    [], // all params required
    [-1], [0], [1], [2] // 0 < a < 1
  ],
  cases: [{
    params: () => [0.5]
  }]
}, {
  name: 'GeneralizedHermite',
  invalidParams: [
    [], // all params required
    [-1, 1, 2], // a1 > 0
    [1, -1, 2], // a2 > 0
    [1, 1, -1], [1, 1, 0], [1, 1, 1] // m > 1
  ],
  cases: [{
    params: () => [2, 2, 6]
  }]
}, {
  name: 'Geometric',
  invalidParams: [
    [], // all params required
    [-1], [0], [2] // 0 < p <= 1
  ],
  cases: [{
    params: () => [0.5]
  }]
}, {
  name: 'HeadsMinusTails',
  invalidParams: [
    [], // all params required
    [-1] // n > 0
  ],
  cases: [{
    params: () => [5]
  }]
}, {
  name: 'Hypergeometric',
  invalidParams: [
    [], // all params required
    [-1, 5, 5], [0, 5, 5], // N > 0
    [10, -1, 5], [10, 12, 5], // 0 <= K <= N
    [10, 5, -1], [10, 5, 12] // 0 <= n <= N
  ],
  cases: [{
    params: () => [30, 10, 5]
  }]
}, {
  name: 'LogSeries',
  invalidParams: [
    [], // all params required
    [-1], [0], [1], [2] // 0 < p < 1
  ],
  cases: [{
    params: () => [0.5]
  }]
}, {
  name: 'NegativeHypergeometric',
  invalidParams: [
    [], // all params required
    [-1, 5, 5], // N >= 0
    [10, -1, 5], [10, 11, 5], // 0 <= K <= N
    [10, 5, -1], [10, 5, 6] // 0 <= r <= K - N
  ],
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
  cases: [{
    params: () => [2, 2]
  }]
}, {
  name: 'Poisson',
  invalidParams: [
    [], // all params required
    [-1], [0] // lambda > 0
  ],
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
  cases: [{
    params: () => [2, 0.5]
  }]
}, {
  name: 'Rademacher',
  invalidParams: [],
  cases: [{
    params: () => []
  }]
}, {
  name: 'Skellam',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // mu1 > 0
    [1, -1], [1, 0] // mu2 > 0
  ],
  cases: [{
    params: () => [5, 5]
  }],
  // k=±1 skipped: ~7.7e-10 precision loss from besselI(1, ·) exceeds 1e-10 refVal tolerance — see #225
  refVals: [
    { x: -10, pmf: 0.000993881922213998, cdf: 0.0015932746537998337 },
    { x: -5, pmf: 0.03528429361493396, cdf: 0.07572690384881897 },
    { x: -3, pmf: 0.07983036102984052, cdf: 0.21123984914729255 },
    { x: -2, pmf: 0.10358080088653754, cdf: 0.3148206500338303 },
    { x: 0, pmf: 0.12783333716342862, cdf: 0.5639166685817145 },
    { x: 2, pmf: 0.10358080088653754, cdf: 0.7887601508527077 },
    { x: 3, pmf: 0.07983036102984052, cdf: 0.8685905118825478 },
    { x: 5, pmf: 0.03528429361493396, cdf: 0.959557389766115 },
    { x: 8, pmf: 0.005269407891006391, cdf: 0.9960314331413155 },
    { x: 10, pmf: 0.000993881922213998, cdf: 0.9994006072684142 }
  ]
}, {
  name: 'Soliton',
  invalidParams: [
    [], // all params required
    [-1], [0] // N > 0
  ],
  cases: [{
    params: () => [10]
  }]
}, {
  name: 'YuleSimon',
  invalidParams: [
    [], // all params required
    [-1], [0] // rho > 0
  ],
  cases: [{
    params: () => [3]
  }]
}, {
  name: 'Zeta',
  invalidParams: [
    [], // all params required
    [-1], [0], [1] // s > 1
  ],
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
  cases: [{
    params: () => [3, 100]
  }]
}]
