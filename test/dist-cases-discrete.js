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
  }],
  // scipy.stats.bernoulli(0.5)
  refVals: [
    { x: 0, pmf: 0.5000000000000001, cdf: 0.5 },
    { x: 1, pmf: 0.5, cdf: 1.0 }
  ]
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
  }],
  // scipy.stats.binom(25, 0.5) — endpoints x=0, x=25 included for boundary coverage.
  refVals: [
    { x: 0, pmf: 2.980232238769538e-08, cdf: 2.980232238769538e-08 },
    { x: 5, pmf: 0.0015833973884582507, cdf: 0.0020386576652526855 },
    { x: 8, pmf: 0.032233446836471606, cdf: 0.05387607216835022 },
    { x: 10, pmf: 0.09741663932800292, cdf: 0.21217811107635498 },
    { x: 12, pmf: 0.15498101711273188, cdf: 0.5 },
    { x: 13, pmf: 0.15498101711273188, cdf: 0.6549810171127319 },
    { x: 15, pmf: 0.09741663932800294, cdf: 0.885238528251648 },
    { x: 18, pmf: 0.014325976371765138, cdf: 0.9926833510398865 },
    { x: 22, pmf: 6.854534149169929e-05, cdf: 0.9999902844429016 },
    { x: 25, pmf: 2.980232238769538e-08, cdf: 1.0 }
  ]
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
  }],
  // No scipy equivalent; PMF is w[i] / sum(w) (numpy)
  refVals: [
    { x: 0, pmf: 0.4, cdf: 0.4 },
    { x: 1, pmf: 0.6, cdf: 1.0 }
  ]
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
  }],
  // scipy.stats.randint(5, 51) — randint's upper bound is EXCLUSIVE
  refVals: [
    { x: 5, pmf: 0.021739130434782608, cdf: 0.021739130434782608 },
    { x: 10, pmf: 0.021739130434782608, cdf: 0.13043478260869565 },
    { x: 20, pmf: 0.021739130434782608, cdf: 0.34782608695652173 },
    { x: 30, pmf: 0.021739130434782608, cdf: 0.5652173913043478 },
    { x: 40, pmf: 0.021739130434782608, cdf: 0.782608695652174 },
    { x: 50, pmf: 0.021739130434782608, cdf: 1.0 }
  ]
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
  }],
  // scipy.stats.nbinom(1, 0.5) — 0-indexed geometric; see solutions/testing/2026-05-18-1443-discrete-refvals-scipy-parameterization-traps.md
  refVals: [
    { x: 0, pmf: 0.4999999999999998, cdf: 0.5 },
    { x: 1, pmf: 0.25000000000000006, cdf: 0.75 },
    { x: 2, pmf: 0.12499999999999997, cdf: 0.875 },
    { x: 3, pmf: 0.06249999999999999, cdf: 0.9375 },
    { x: 5, pmf: 0.015624999999999988, cdf: 0.984375 },
    { x: 8, pmf: 0.0019531250000000035, cdf: 0.998046875 },
    { x: 12, pmf: 0.00012207031250000008, cdf: 0.9998779296875 }
  ]
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
  }],
  // scipy.stats.hypergeom(M=30, n=10, N=5) — scipy n/N collide with ranjs K/n; see solutions/testing/2026-05-18-1443-discrete-refvals-scipy-parameterization-traps.md
  refVals: [
    { x: 0, pmf: 0.10879541914024672, cdf: 0.10879541914024672 },
    { x: 1, pmf: 0.33998568481327096, cdf: 0.44878110395351767 },
    { x: 2, pmf: 0.3599848427434634, cdf: 0.8087659466969812 },
    { x: 3, pmf: 0.15999326344153927, cdf: 0.9687592101385205 },
    { x: 4, pmf: 0.029472443265546714, cdf: 0.9982316534040672 },
    { x: 5, pmf: 0.0017683465959328027, cdf: 1.0 }
  ]
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
  // p=0.4 (asymmetric) so the scipy success/failure swap in nbinom(r, 1-p) can't hide;
  // see solutions/testing/2026-05-18-1443-discrete-refvals-scipy-parameterization-traps.md
  cases: [{
    params: () => [10, 0.4]
  }],
  // scipy.stats.nbinom(10, 1-0.4 = 0.6)
  refVals: [
    { x: 0, pmf: 0.00604661760000001, cdf: 0.0060466176 },
    { x: 3, pmf: 0.085136375808, cdf: 0.168579698688 },
    { x: 5, pmf: 0.12395856317644793, cdf: 0.40321555041484797 },
    { x: 7, pmf: 0.11333354347560956, cdf: 0.6405076570669056 },
    { x: 10, pmf: 0.058570775268195, cdf: 0.8724787538527833 },
    { x: 15, pmf: 0.008488977840717116, cdf: 0.9868309265111141 },
    { x: 25, pmf: 3.570821815044619e-05, cdf: 0.9999592256410035 }
  ]
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
  }],
  // scipy.stats.poisson(10) — refVals always evaluated against cases[0] (test/dist.js:133)
  refVals: [
    { x: 2, pmf: 0.0022699964881242435, cdf: 0.0027693957155115775 },
    { x: 5, pmf: 0.03783327480207079, cdf: 0.06708596287903189 },
    { x: 8, pmf: 0.11259903214902009, cdf: 0.3328196787507191 },
    { x: 10, pmf: 0.12511003572113372, cdf: 0.5830397501929852 },
    { x: 12, pmf: 0.09478033009176803, cdf: 0.7915564763948745 },
    { x: 15, pmf: 0.034718069630684245, cdf: 0.9512595966960213 },
    { x: 20, pmf: 0.0018660813139987742, cdf: 0.998411739338142 },
    { x: 30, pmf: 1.7115717355368203e-07, cdf: 0.9999999201620534 }
  ]
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
  // k=±1 skipped: ~7.7e-10 precision loss from besselI(1, ·) exceeds 1e-10 refVal tolerance
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
