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
  ],
  // scipy.stats.bernoulli(0.5)
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 0 },
    { p: 0.25, x: 0 },
    { p: 0.5, x: 0 },
    { p: 0.75, x: 1 },
    { p: 0.95, x: 1 },
    { p: 0.99, x: 1 }
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
  }],
  // scipy.stats.betabinom(n=25, a=2, b=2)
  refVals: [
    { x: 0, pmf: 0.007936507936507943, cdf: 0.007936507936507943 },
    { x: 3.0, pmf: 0.028083028083028087, cdf: 0.07326007326007328 },
    { x: 7.0, pmf: 0.04639804639804648, cdf: 0.2344322344322346 },
    { x: 10.0, pmf: 0.053724053724053936, cdf: 0.38949938949938967 },
    { x: 12.0, pmf: 0.05555555555555544, cdf: 0.5000000000000001 },
    { x: 15.0, pmf: 0.053724053724053936, cdf: 0.6642246642246644 },
    { x: 20.0, pmf: 0.03846153846153849, cdf: 0.8931623931623933 },
    { x: 25.0, pmf: 0.007936507936507943, cdf: 1.0 }
  ],
  // scipy.stats.betabinom(n=25, a=2, b=2)
  quantileVals: [
    { p: 0.01, x: 1 },
    { p: 0.05, x: 3 },
    { p: 0.25, x: 8 },
    { p: 0.5, x: 13 },
    { p: 0.75, x: 17 },
    { p: 0.95, x: 22 },
    { p: 0.99, x: 24 }
  ]
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
  ],
  // scipy.stats.binom(25, 0.5)
  quantileVals: [
    { p: 0.01, x: 7 },
    { p: 0.05, x: 8 },
    { p: 0.25, x: 11 },
    { p: 0.5, x: 12 },
    { p: 0.75, x: 14 },
    { p: 0.95, x: 17 },
    { p: 0.99, x: 18 }
  ]
}, {
  name: 'Borel',
  invalidParams: [
    [], // all params required
    [-1], [2] // 0 <= mu <= 1
  ],
  // 'positive parameter' is first so refVals (always evaluated against cases[0]
  // per test/dist.js:133) exercises the non-degenerate distribution.
  cases: [{
    name: 'positive parameter',
    params: () => [0.5]
  }, {
    name: 'zero parameter',
    params: () => [0]
  }],
  // mu=0 degenerates to a point mass at 1; the chi-test trivially passes regardless of sampler behavior
  sampleParams: [{ name: 'positive parameter', params: () => [0.5] }],
  // Borel(mu=0.5): pmf(k)=e^(-μk)(μk)^(k-1)/k!, CDF via cumulative sum
  refVals: [
    { x: 1.0, pmf: 0.6065306597126334, cdf: 0.6065306597126334 },
    { x: 2.0, pmf: 0.18393972058572117, cdf: 0.7904703802983546 },
    { x: 3.0, pmf: 0.08367381005566117, cdf: 0.8741441903540158 },
    { x: 4.0, pmf: 0.0451117610788709, cdf: 0.9192559514328867 },
    { x: 6.0, pmf: 0.016803135574154082, cdf: 0.9627794641632579 },
    { x: 8.0, pmf: 0.007442545326215793, cdf: 0.9812360594716548 },
    { x: 12.0, pmf: 0.001877413336924442, cdf: 0.994481007535648 },
    { x: 20.0, pmf: 0.00018660813139987598, cdf: 0.9993627401273154 }
  ],
  // Borel(mu=0.5) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 1 },
    { p: 0.05, x: 1 },
    { p: 0.25, x: 1 },
    { p: 0.5, x: 1 },
    { p: 0.75, x: 2 },
    { p: 0.95, x: 6 },
    { p: 0.99, x: 10 }
  ]
}, {
  name: 'BorelTanner',
  invalidParams: [
    [], // all params required
    [-1, 2], [2, 2], // 0 <= mu <= 1
    [0.5, -1], [0.5, 0] // k > 0
  ],
  // 'positive parameter' is first so refVals (always evaluated against cases[0]
  // per test/dist.js:133) exercises the non-degenerate distribution.
  cases: [{
    name: 'positive parameter',
    params: () => [0.5, 5]
  }, {
    name: 'zero parameter',
    params: () => [0, 5]
  }],
  // mu=0 degenerates to a point mass at n; the chi-test trivially passes regardless of sampler behavior
  sampleParams: [{ name: 'positive parameter', params: () => [0.5, 5] }],
  // BorelTanner(mu=0.5, n=5): pmf=(n/k)·e^(-μk)(μk)^(k-n)/(k-n)!, CDF via cumulative sum
  refVals: [
    { x: 5.0, pmf: 0.0820849986238988, cdf: 0.0820849986238988 },
    { x: 6.0, pmf: 0.12446767091965986, cdf: 0.20655266954355866 },
    { x: 7.0, pmf: 0.13211355247264345, cdf: 0.3386662220162021 },
    { x: 8.0, pmf: 0.12210425925822786, cdf: 0.46077048127443 },
    { x: 10.0, pmf: 0.08773368488392536, cdf: 0.6539528442362021 },
    { x: 12.0, pmf: 0.05736540751713573, cdf: 0.7827352034608114 },
    { x: 15.0, pmf: 0.02861012346955784, cdf: 0.8932594545773648 },
    { x: 25.0, pmf: 0.002657202272307442, cdf: 0.9897914880529921 }
  ],
  // BorelTanner(mu=0.5, n=5) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 5 },
    { p: 0.05, x: 5 },
    { p: 0.25, x: 7 },
    { p: 0.5, x: 9 },
    { p: 0.75, x: 12 },
    { p: 0.95, x: 19 },
    { p: 0.99, x: 26 }
  ]
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
  // moderate/large n excluded for test-suite speed; the sampler's code path is independent of the number of categories
  sampleParams: [{ name: 'small n', params: () => [[0.4, 0.6], 0] }],
  // No scipy equivalent; PMF is w[i] / sum(w) (numpy)
  refVals: [
    { x: 0, pmf: 0.4, cdf: 0.4 },
    { x: 1, pmf: 0.6, cdf: 1.0 }
  ],
  // Categorical([0.4, 0.6], offset=0) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 0 },
    { p: 0.25, x: 0 },
    { p: 0.5, x: 1 },
    { p: 0.75, x: 1 },
    { p: 0.95, x: 1 },
    { p: 0.99, x: 1 }
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
  }],
  // mpmath: Delaporte(α=2, β=2, λ=2) direct sum formula @ 50 dps; CDF via cumulative sum
  refVals: [
    { x: 0, pmf: 0.015037253692956967, cdf: 0.015037253692956967 },
    { x: 1.0, pmf: 0.05012417897652322, cdf: 0.06516143266948018 },
    { x: 2.0, pmf: 0.09022352215774179, cdf: 0.15538495482722198 },
    { x: 3.0, pmf: 0.11807028825581024, cdf: 0.2734552430830322 },
    { x: 5.0, pmf: 0.12133764214465029, cdf: 0.5221454288495155 },
    { x: 8.0, pmf: 0.0707262675425665, cdf: 0.7878701739239051 },
    { x: 12.0, pmf: 0.023278610148764332, cdf: 0.9394756377198948 },
    { x: 20.0, pmf: 0.0016349305025805995, cdf: 0.9961851621606456 }
  ],
  // Delaporte(α=2, β=2, λ=2) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 1 },
    { p: 0.25, x: 3 },
    { p: 0.5, x: 5 },
    { p: 0.75, x: 8 },
    { p: 0.95, x: 13 },
    { p: 0.99, x: 18 }
  ]
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
  ],
  // scipy.stats.randint(5, 51) — upper bound is exclusive
  quantileVals: [
    { p: 0.01, x: 5 },
    { p: 0.05, x: 7 },
    { p: 0.25, x: 16 },
    { p: 0.5, x: 27 },
    { p: 0.75, x: 39 },
    { p: 0.95, x: 48 },
    { p: 0.99, x: 50 }
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
  }],
  // DiscreteWeibull(q=0.5, β=2): closed form pmf(k)=q^(k^β)-q^((k+1)^β), cdf(k)=1-q^((k+1)^β)
  refVals: [
    { x: 0, pmf: 0.5, cdf: 0.5 },
    { x: 1.0, pmf: 0.4375, cdf: 0.9375 },
    { x: 2.0, pmf: 0.060546875, cdf: 0.998046875 },
    { x: 3.0, pmf: 0.0019378662109375, cdf: 0.9999847412109375 },
    { x: 4.0, pmf: 1.5228986740112305e-05, cdf: 0.9999999701976776 },
    { x: 5.0, pmf: 2.9787770472466946e-08, cdf: 0.9999999999854481 },
    { x: 7.0, pmf: 1.7763026292916262e-15, cdf: 1.0 },
    { x: 10.0, pmf: 7.888605290628195e-31, cdf: 1.0 }
  ],
  // DiscreteWeibull(q=0.5, β=2) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 0 },
    { p: 0.25, x: 0 },
    { p: 0.5, x: 0 },
    { p: 0.75, x: 1 },
    { p: 0.95, x: 2 },
    { p: 0.99, x: 2 }
  ]
}, {
  name: 'FlorySchulz',
  invalidParams: [
    [], // all params required
    [-1], [0], [1], [2] // 0 < a < 1
  ],
  cases: [{
    params: () => [0.5]
  }, {
    // Small-a boundary region where the naive formula loses all digits (issue #248)
    params: () => [1e-8],
    refVals: [
      { x: 1, pmf: 1.0000000000000001e-16, cdf: 1.0000000003187713e-16 },
      { x: 2, pmf: 1.99999998e-16, cdf: 2.9999999844127016e-16 },
      { x: 5, pmf: 4.999999800000002e-16, cdf: 1.4999999591191263e-15 }
    ]
  }],
  sampleParams: [{ params: () => [0.5] }],
  // FlorySchulz(a=0.5): pmf=a^2·k·(1-a)^(k-1); cdf=1-(1-a)^k(1+a·k)
  refVals: [
    { x: 1.0, pmf: 0.25, cdf: 0.25 },
    { x: 2.0, pmf: 0.25, cdf: 0.5 },
    { x: 3.0, pmf: 0.1875, cdf: 0.6875 },
    { x: 4.0, pmf: 0.125, cdf: 0.8125 },
    { x: 6.0, pmf: 0.046875, cdf: 0.9375 },
    { x: 9.0, pmf: 0.0087890625, cdf: 0.9892578125 },
    { x: 15.0, pmf: 0.0002288818359375, cdf: 0.9997406005859375 },
    { x: 25.0, pmf: 3.725290298461914e-07, cdf: 0.9999995976686478 }
  ],
  // FlorySchulz(a=0.5) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 1 },
    { p: 0.05, x: 1 },
    { p: 0.25, x: 1 },
    { p: 0.5, x: 2 },
    { p: 0.75, x: 4 },
    { p: 0.95, x: 7 },
    { p: 0.99, x: 10 }
  ]
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
  }],
  // GeneralizedHermite(a1=2, a2=2, m=6) as X1 + 6·X2, X_i ~ scipy.stats.poisson(2); CDF via cumsum
  refVals: [
    { x: 0, pmf: 0.018315638888734182, cdf: 0.018315638888734182 },
    { x: 1.0, pmf: 0.036631277777468364, cdf: 0.05494691666620255 },
    { x: 2.0, pmf: 0.036631277777468364, cdf: 0.09157819444367091 },
    { x: 3.0, pmf: 0.02442085185164557, cdf: 0.11599904629531647 },
    { x: 6.0, pmf: 0.03825933456757807, cdf: 0.17135297715904646 },
    { x: 8.0, pmf: 0.07337884532565885, cdf: 0.3184595371225305 },
    { x: 12.0, pmf: 0.0398875479769076, cdf: 0.4414099317158779 },
    { x: 18.0, pmf: 0.027677278671054566, cdf: 0.6998700442018335 }
  ],
  // GeneralizedHermite(a1=2, a2=2, m=6) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 1 },
    { p: 0.25, x: 8 },
    { p: 0.5, x: 13 },
    { p: 0.75, x: 20 },
    { p: 0.95, x: 30 },
    { p: 0.99, x: 38 }
  ]
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
  ],
  // scipy.stats.nbinom(1, 0.5) — 0-indexed geometric; see refVals parameterization note
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 0 },
    { p: 0.25, x: 0 },
    { p: 0.5, x: 0 },
    { p: 0.75, x: 1 },
    { p: 0.95, x: 4 },
    { p: 0.99, x: 6 }
  ]
}, {
  name: 'HeadsMinusTails',
  invalidParams: [
    [], // all params required
    [-1] // n > 0
  ],
  cases: [{
    params: () => [5]
  }],
  // HeadsMinusTails(n=5): pmf(0)=C(2n,n)/4^n, pmf(2m)=2·C(2n,n+m)/4^n; CDF via cumulative sum
  refVals: [
    { x: 0, pmf: 0.24609375, cdf: 0.24609375 },
    { x: 2.0, pmf: 0.41015625, cdf: 0.65625 },
    { x: 4.0, pmf: 0.234375, cdf: 0.890625 },
    { x: 6.0, pmf: 0.087890625, cdf: 0.978515625 },
    { x: 8.0, pmf: 0.01953125, cdf: 0.998046875 },
    { x: 10.0, pmf: 0.001953125, cdf: 1.0 }
  ],
  // HeadsMinusTails(n=5) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 0 },
    { p: 0.25, x: 2 },
    { p: 0.5, x: 2 },
    { p: 0.75, x: 4 },
    { p: 0.95, x: 6 },
    { p: 0.99, x: 8 }
  ]
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
  ],
  // scipy.stats.hypergeom(M=30, n=10, N=5) — see refVals parameterization note
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 0 },
    { p: 0.25, x: 1 },
    { p: 0.5, x: 2 },
    { p: 0.75, x: 2 },
    { p: 0.95, x: 3 },
    { p: 0.99, x: 4 }
  ]
}, {
  name: 'LogSeries',
  invalidParams: [
    [], // all params required
    [-1], [0], [1], [2] // 0 < p < 1
  ],
  cases: [{
    params: () => [0.5]
  }],
  // scipy.stats.logser(p=0.5)
  refVals: [
    { x: 1.0, pmf: 0.7213475204444817, cdf: 0.7213475204444817 },
    { x: 2.0, pmf: 0.18033688011112042, cdf: 0.9016844005556022 },
    { x: 3.0, pmf: 0.06011229337037347, cdf: 0.9617966939259757 },
    { x: 4.0, pmf: 0.022542110013890053, cdf: 0.9843388039398657 },
    { x: 5.0, pmf: 0.009016844005556022, cdf: 0.9933556479454217 },
    { x: 7.0, pmf: 0.001610150715277861, cdf: 0.9987228169963479 },
    { x: 10.0, pmf: 0.00014088818758681285, cdf: 0.9998812309831728 },
    { x: 20.0, pmf: 6.879306034512346e-08, cdf: 0.999999937229902 }
  ],
  // scipy.stats.logser(p=0.5)
  quantileVals: [
    { p: 0.01, x: 1 },
    { p: 0.05, x: 1 },
    { p: 0.25, x: 1 },
    { p: 0.5, x: 1 },
    { p: 0.75, x: 2 },
    { p: 0.95, x: 3 },
    { p: 0.99, x: 5 }
  ]
}, {
  name: 'NegativeHypergeometric',
  invalidParams: [
    [], // all params required
    [-1, 5, 5], // N >= 0
    [10, -1, 5], [10, 11, 5], // 0 <= K <= N
    [10, 5, -1], [10, 5, 6] // 0 < r <= N - K
  ],
  cases: [{
    params: () => [35, 15, 7]
  }],
  // scipy.stats.nhypergeom(M=35, n=15, r=7)
  refVals: [
    { x: 0, pmf: 0.0115279603600311, cdf: 0.0115279603600311 },
    { x: 2, pmf: 0.08966191391124509, cdf: 0.1444197256213678 },
    { x: 5, pmf: 0.16273637374860703, cdf: 0.603040415276796 },
    { x: 8, pmf: 0.07167384049897532, cdf: 0.9237349067403976 },
    { x: 12, pmf: 0.0032007456682079717, cdf: 0.998939093503107 },
    { x: 15, pmf: 0.000016707188927434303, cdf: 1 }
  ],
  // scipy.stats.nhypergeom(M=35, n=15, r=7)
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 1 },
    { p: 0.25, x: 3 },
    { p: 0.5, x: 5 },
    { p: 0.75, x: 7 },
    { p: 0.95, x: 9 },
    { p: 0.99, x: 11 }
  ]
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
  ],
  // scipy.stats.nbinom(10, 0.6) — ranjs p is failures; scipy p is successes; see refVals note
  quantileVals: [
    { p: 0.01, x: 1 },
    { p: 0.05, x: 2 },
    { p: 0.25, x: 4 },
    { p: 0.5, x: 6 },
    { p: 0.75, x: 9 },
    { p: 0.95, x: 13 },
    { p: 0.99, x: 16 }
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
  }],
  // NeymanA(λ=2, φ=2) compound Poisson: pmf(k)=Σ_j Pois(j;λ)·Pois(k;jφ); CDF via cumsum
  refVals: [
    { x: 0, pmf: 0.17740333081914028, cdf: 0.17740333081914028 },
    { x: 1.0, pmf: 0.09603572009410741, cdf: 0.2734390509132477 },
    { x: 2.0, pmf: 0.12202976285364354, cdf: 0.39546881376689125 },
    { x: 3.0, pmf: 0.12070244710091246, cdf: 0.5161712608678037 },
    { x: 4.0, pmf: 0.10737111436151524, cdf: 0.623542375229319 },
    { x: 6.0, pmf: 0.07407697138311874, cdf: 0.7884728507179998 },
    { x: 10.0, pmf: 0.023888133739920096, cdf: 0.9481690751884645 },
    { x: 20.0, pmf: 0.0003644479532151495, cdf: 0.999442904902409 }
  ],
  // NeymanA(λ=2, φ=2) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 0 },
    { p: 0.25, x: 1 },
    { p: 0.5, x: 3 },
    { p: 0.75, x: 6 },
    { p: 0.95, x: 11 },
    { p: 0.99, x: 14 }
  ]
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
  // Keep both sampleParams: Knuth (lambda < 30) and Atkinson (lambda >= 30) are separate code paths
  sampleParams: [{ name: 'low mean', params: () => [10] }, { name: 'high mean', params: () => [40] }],
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
  ],
  // scipy.stats.poisson(10)
  quantileVals: [
    { p: 0.01, x: 3 },
    { p: 0.05, x: 5 },
    { p: 0.25, x: 8 },
    { p: 0.5, x: 10 },
    { p: 0.75, x: 12 },
    { p: 0.95, x: 15 },
    { p: 0.99, x: 18 }
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
  }],
  // PolyaAeppli(λ=2, θ=0.5) closed-form series; CDF via cumsum
  refVals: [
    { x: 0, pmf: 0.1353352832366127, cdf: 0.1353352832366127 },
    { x: 1.0, pmf: 0.1353352832366127, cdf: 0.2706705664732254 },
    { x: 2.0, pmf: 0.1353352832366127, cdf: 0.4060058497098381 },
    { x: 3.0, pmf: 0.12405734296689497, cdf: 0.5300631926767331 },
    { x: 4.0, pmf: 0.10714043256231838, cdf: 0.6372036252390515 },
    { x: 6.0, pmf: 0.07067509235689774, cdf: 0.7964105487132334 },
    { x: 10.0, pmf: 0.02262304843105503, cdf: 0.9464595907555691 },
    { x: 20.0, pmf: 0.0005328296608723276, cdf: 0.9989993828812536 }
  ],
  // PolyaAeppli(λ=2, θ=0.5) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 0 },
    { p: 0.05, x: 0 },
    { p: 0.25, x: 1 },
    { p: 0.5, x: 3 },
    { p: 0.75, x: 6 },
    { p: 0.95, x: 11 },
    { p: 0.99, x: 15 }
  ]
}, {
  name: 'Rademacher',
  invalidParams: [],
  cases: [{
    params: () => []
  }],
  // Rademacher: P(X=-1) = P(X=1) = 0.5
  refVals: [
    { x: -1.0, pmf: 0.5, cdf: 0.5 },
    { x: 1.0, pmf: 0.5, cdf: 1.0 }
  ],
  // Rademacher — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: -1 },
    { p: 0.05, x: -1 },
    { p: 0.25, x: -1 },
    { p: 0.5, x: -1 },
    { p: 0.75, x: 1 },
    { p: 0.95, x: 1 },
    { p: 0.99, x: 1 }
  ]
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
  refVals: [
    { x: -10, pmf: 0.000993881922213998, cdf: 0.0015932746537998337 },
    { x: -5, pmf: 0.03528429361493396, cdf: 0.07572690384881897 },
    { x: -3, pmf: 0.07983036102984052, cdf: 0.21123984914729255 },
    { x: -2, pmf: 0.10358080088653754, cdf: 0.3148206500338303 },
    { x: -1, pmf: 0.1212626813844554, cdf: 0.4360833314182855 },
    { x: 0, pmf: 0.12783333716342862, cdf: 0.5639166685817145 },
    { x: 1, pmf: 0.1212626813844554, cdf: 0.6851793499661697 },
    { x: 2, pmf: 0.10358080088653754, cdf: 0.7887601508527077 },
    { x: 3, pmf: 0.07983036102984052, cdf: 0.8685905118825478 },
    { x: 5, pmf: 0.03528429361493396, cdf: 0.959557389766115 },
    { x: 8, pmf: 0.005269407891006391, cdf: 0.9960314331413155 },
    { x: 10, pmf: 0.000993881922213998, cdf: 0.9994006072684142 }
  ],
  // scipy.stats.skellam(mu1=5, mu2=5)
  quantileVals: [
    { p: 0.01, x: -7 },
    { p: 0.05, x: -5 },
    { p: 0.25, x: -2 },
    { p: 0.5, x: 0 },
    { p: 0.75, x: 2 },
    { p: 0.95, x: 5 },
    { p: 0.99, x: 7 }
  ]
}, {
  name: 'Soliton',
  invalidParams: [
    [], // all params required
    [-1], [0] // N > 0
  ],
  cases: [{
    params: () => [10]
  }],
  // Ideal soliton N=10: pmf(1)=1/10, pmf(k)=1/(k(k-1)) for k=2..10
  // CDF is the telescoping sum; cdf(10)=1.
  refVals: [
    { x: 1, pmf: 0.1, cdf: 0.1 },
    { x: 2, pmf: 0.5, cdf: 0.6 },
    { x: 3, pmf: 1 / 6, cdf: 23 / 30 },
    { x: 4, pmf: 1 / 12, cdf: 17 / 20 },
    { x: 5, pmf: 1 / 20, cdf: 0.9 },
    { x: 6, pmf: 1 / 30, cdf: 14 / 15 },
    { x: 7, pmf: 1 / 42, cdf: 67 / 70 },
    { x: 8, pmf: 1 / 56, cdf: 39 / 40 },
    { x: 9, pmf: 1 / 72, cdf: 89 / 90 },
    { x: 10, pmf: 1 / 90, cdf: 1.0 }
  ],
  // Soliton(N=10) — ranjs quantile cross-validated against CDF refVals
  quantileVals: [
    { p: 0.01, x: 1 },
    { p: 0.05, x: 1 },
    { p: 0.25, x: 2 },
    { p: 0.5, x: 2 },
    { p: 0.75, x: 3 },
    { p: 0.95, x: 7 },
    { p: 0.99, x: 10 }
  ]
}, {
  name: 'YuleSimon',
  invalidParams: [
    [], // all params required
    [-1], [0] // rho > 0
  ],
  cases: [{
    params: () => [3]
  }],
  // scipy.stats.yulesimon(alpha=3)
  refVals: [
    { x: 1.0, pmf: 0.75, cdf: 0.75 },
    { x: 2.0, pmf: 0.15000000000000002, cdf: 0.9 },
    { x: 3.0, pmf: 0.05, cdf: 0.95 },
    { x: 4.0, pmf: 0.02142857142857143, cdf: 0.9714285714285714 },
    { x: 6.0, pmf: 0.005952380952380954, cdf: 0.9880952380952381 },
    { x: 10.0, pmf: 0.0010489510489510487, cdf: 0.9965034965034965 },
    { x: 20.0, pmf: 8.469791078486729e-05, cdf: 0.9994353472614342 },
    { x: 50.0, pmf: 2.561256723298898e-06, cdf: 0.999957312387945 }
  ],
  // scipy.stats.yulesimon(alpha=3)
  quantileVals: [
    { p: 0.01, x: 1 },
    { p: 0.05, x: 1 },
    { p: 0.25, x: 1 },
    { p: 0.5, x: 1 },
    { p: 0.75, x: 1 },
    { p: 0.95, x: 3 },
    { p: 0.99, x: 7 }
  ]
}, {
  name: 'Zeta',
  invalidParams: [
    [], // all params required
    [-1], [0], [1] // s > 1
  ],
  cases: [{
    params: () => [3.8]
  }],
  // scipy.stats.zipf(a=3.8)  # scipy zipf is the Zeta distribution
  refVals: [
    { x: 1.0, pmf: 0.9111529505495871, cdf: 0.9111529505495871 },
    { x: 2.0, pmf: 0.06541499346543785, cdf: 0.976567944015025 },
    { x: 3.0, pmf: 0.014012980508908498, cdf: 0.9905809245239335 },
    { x: 4.0, pmf: 0.004696380961618142, cdf: 0.9952773054855517 },
    { x: 6.0, pmf: 0.0010060429786992943, cdf: 0.9982947800674529 },
    { x: 10.0, pmf: 0.0001444080108616899, cdf: 0.9995519091451442 },
    { x: 20.0, pmf: 1.036757778282607e-05, cdf: 0.9999309656983761 },
    { x: 50.0, pmf: 3.18790425501579e-07, cdf: 0.9999944646904115 }
  ],
  // scipy.stats.zipf(a=3.8) — scipy zipf is the Zeta distribution
  quantileVals: [
    { p: 0.01, x: 1 },
    { p: 0.05, x: 1 },
    { p: 0.25, x: 1 },
    { p: 0.5, x: 1 },
    { p: 0.75, x: 1 },
    { p: 0.95, x: 2 },
    { p: 0.99, x: 3 }
  ]
}, {
  name: 'Zipf',
  invalidParams: [
    [], // all params required
    [-1, 100], // s >= 1
    [1, -1], [1, 0] // N > 0
  ],
  cases: [{
    params: () => [3, 100]
  }],
  // scipy.stats.zipfian(a=3, n=100)
  refVals: [
    { x: 1.0, pmf: 0.8319416331806166, cdf: 0.8319416331806166 },
    { x: 2.0, pmf: 0.10399270414757711, cdf: 0.9359343373281938 },
    { x: 3.0, pmf: 0.030812653080763582, cdf: 0.9667469904089574 },
    { x: 5.0, pmf: 0.00665553306544493, cdf: 0.9864016114928494 },
    { x: 10.0, pmf: 0.0008319416331806169, cdf: 0.9962767159478153 },
    { x: 30.0, pmf: 3.081265308076359e-05, cdf: 0.9995941430438425 },
    { x: 70.0, pmf: 2.425485811022207e-06, cdf: 0.9999574952682868 },
    { x: 100.0, pmf: 8.319416331806168e-07, cdf: 1.0 }
  ],
  // scipy.stats.zipfian(a=3, n=100)
  quantileVals: [
    { p: 0.01, x: 1 },
    { p: 0.05, x: 1 },
    { p: 0.25, x: 1 },
    { p: 0.5, x: 1 },
    { p: 0.75, x: 1 },
    { p: 0.95, x: 3 },
    { p: 0.99, x: 6 }
  ]
}]
