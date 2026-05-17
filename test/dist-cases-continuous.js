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
    { x: -0.1, pdf: 0, cdf: 0 },
    { x: 0.02, pdf: 0.1176, cdf: 0.001184 },
    { x: 0.1, pdf: 0.54, cdf: 0.028 },
    { x: 0.25, pdf: 1.125, cdf: 0.15625 },
    { x: 0.5, pdf: 1.5, cdf: 0.5 },
    { x: 0.75, pdf: 1.125, cdf: 0.84375 },
    { x: 0.9, pdf: 0.54, cdf: 0.972 },
    { x: 0.98, pdf: 0.1176, cdf: 0.998816 },
    { x: 1.1, pdf: 0, cdf: 1 }
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
  }],
  refVals: [
    { x: 0.5, pdf: 0.37642179019350486, cdf: 0.22662735237686846 },
    { x: 1, pdf: 0.19875264925802133, cdf: 0.36183680491588205 },
    { x: 2, pdf: 0.09973557010035815, cdf: 0.5 },
    { x: 4, pdf: 0.04968816231450541, cdf: 0.638163195084118 },
    { x: 6, pdf: 0.03249494262045689, cdf: 0.718148569174613 },
    { x: 10, pdf: 0.01793901239509232, cdf: 0.8144533152386513 }
  ]
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
    { x: -20, pdf: 0.001575791515761340, cdf: 0.03172551743055352 },
    { x: -10, pdf: 0.006121343965072898, cdf: 0.06283295818900118 },
    { x: -4, pdf: 0.03183098861837907, cdf: 0.14758361765043326 },
    { x: -1, pdf: 0.12732395447351627, cdf: 0.35241638234956674 },
    { x: 0, pdf: 0.15915494309189535, cdf: 0.5 },
    { x: 1, pdf: 0.1273239544735163, cdf: 0.6475836176504333 },
    { x: 2, pdf: 0.07957747154594767, cdf: 0.75 },
    { x: 5, pdf: 0.021952405943709702, cdf: 0.8788810584091566 },
    { x: 10, pdf: 0.006121343965072898, cdf: 0.937167041810999 },
    { x: 20, pdf: 0.00157579151576134, cdf: 0.9682744825694465 }
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
  }],
  refVals: [
    { x: 0, pdf: 0.7978845608028654, cdf: 0 },
    { x: 0.1, pdf: 0.793905094954024, cdf: 0.079655674554058 },
    { x: 0.5, pdf: 0.704130653528599, cdf: 0.382924922548026 },
    { x: 1, pdf: 0.483941449038287, cdf: 0.682689492137086 },
    { x: 1.5, pdf: 0.259035191331783, cdf: 0.866385597462284 },
    { x: 2, pdf: 0.107981933026376, cdf: 0.954499736103641 },
    { x: 2.5, pdf: 0.0350566009871371, cdf: 0.987580669348448 },
    { x: 3, pdf: 0.00886369682387601, cdf: 0.99730020393674 },
    { x: 4, pdf: 0.000267660451529771, cdf: 0.999936657516334 },
    { x: 5, pdf: 2.9734390294686e-06, cdf: 0.999999426696856 }
  ]
}, {
  name: 'Chi2',
  invalidParams: [
    [], // all params required
    [-1], [0] // k > 0
  ],
  cases: [{
    params: () => [5]
  }],
  refVals: [
    { x: 0, pdf: 0, cdf: 0 },
    { x: 0.1, pdf: 0.00400012982810046, cdf: 0.000162316611922615 },
    { x: 0.5, pdf: 0.0366159407889769, cdf: 0.0078767067673704 },
    { x: 1, pdf: 0.0806569081730478, cdf: 0.0374342267527036 },
    { x: 2, pdf: 0.138369165806865, cdf: 0.15085496391539 },
    { x: 4, pdf: 0.143975910701835, cdf: 0.45058404864722 },
    { x: 7, pdf: 0.0743712677201228, cdf: 0.779359692063289 },
    { x: 9, pdf: 0.0398866357074421, cdf: 0.890935842050227 },
    { x: 12, pdf: 0.013702310000441, cdf: 0.965212219493758 },
    { x: 15, pdf: 0.00427284447460706, cdf: 0.989637662084214 }
  ]
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
  }],
  refVals: [
    { x: 0, pdf: 0, cdf: 0 },
    { x: 0.1, pdf: 0.000109164100410398, cdf: 2.25819055295782e-06 },
    { x: 0.5, pdf: 0.0306566200976202, cdf: 0.00365984682734371 },
    { x: 1, pdf: 0.180447044315484, cdf: 0.0526530173437111 },
    { x: 1.5, pdf: 0.336062711483082, cdf: 0.184736755476228 },
    { x: 2, pdf: 0.390733629626329, cdf: 0.371163064820127 },
    { x: 3, pdf: 0.267705235079967, cdf: 0.714943499683369 },
    { x: 4, pdf: 0.114504576990724, cdf: 0.900367599512954 },
    { x: 5, pdf: 0.0378332748020707, cdf: 0.970747311923039 },
    { x: 7, pdf: 0.00266200060609022, cdf: 0.998194751150826 }
  ]
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
    { x: -0.1, pdf: 0, cdf: 0 },
    { x: 0.05, pdf: 1.809674836071919, cdf: 0.09516258196404044 },
    { x: 0.25, pdf: 1.2130613194252668, cdf: 0.3934693402873666 },
    { x: 0.5, pdf: 0.7357588823428847, cdf: 0.6321205588285577 },
    { x: 1, pdf: 0.2706705664732254, cdf: 0.8646647167633873 },
    { x: 2, pdf: 0.03663127777746836, cdf: 0.9816843611112658 },
    { x: 3, pdf: 0.004957504353332717, cdf: 0.9975212478233336 },
    { x: 5, pdf: 9.079985952496971e-05, cdf: 0.9999546000702375 },
    { x: 8, pdf: 2.2507034943851823e-07, cdf: 0.9999998874648253 }
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
  }],
  refVals: [
    { x: 0, pdf: 0, cdf: 0 },
    { x: 0.1, pdf: 0.266670770930713, cdf: 0.0122419165310697 },
    { x: 0.2, pdf: 0.488177327446624, cdf: 0.0509697394149292 },
    { x: 0.5, pdf: 0.632320924379202, cdf: 0.232511319130379 },
    { x: 1, pdf: 0.424413181578387, cdf: 0.5 },
    { x: 2, pdf: 0.1580802310948, cdf: 0.767488680869621 },
    { x: 3, pdf: 0.0689161119277241, cdf: 0.873415002449839 },
    { x: 4, pdf: 0.0347679278349015, cdf: 0.922811374757793 },
    { x: 6, pdf: 0.011876145719987, cdf: 0.964328219266231 },
    { x: 8, pdf: 0.00520428744345023, cdf: 0.980247095162329 }
  ]
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
    { x: -0.1, pdf: 0, cdf: 0 },
    { x: 0.05, pdf: 0.18096748360719195, cdf: 0.004678840160444474 },
    { x: 0.25, pdf: 0.6065306597126333, cdf: 0.09020401043104986 },
    { x: 0.5, pdf: 0.7357588823428847, cdf: 0.2642411176571153 },
    { x: 1, pdf: 0.5413411329464508, cdf: 0.5939941502901616 },
    { x: 2, pdf: 0.14652511110987346, cdf: 0.9084218055563291 },
    { x: 3, pdf: 0.029745026119996285, cdf: 0.9826487347633355 },
    { x: 5, pdf: 0.0009079985952496972, cdf: 0.9995006007726127 },
    { x: 8, pdf: 3.601125591016293e-06, cdf: 0.9999980869020297 }
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
  }],
  refVals: [
    { x: -4, pdf: 0.005166746338523012, cdf: 0.002338867490523638 },
    { x: -2, pdf: 0.1037768743551491, cdf: 0.07864960352514046 },
    { x: -0.5, pdf: 0.26500353234402857, cdf: 0.36183680491588144 },
    { x: 1, pdf: 0.21969564473386108, cdf: 0.7602499389065226 },
    { x: 2, pdf: 0.1037768743551491, cdf: 0.9213503964748596 },
    { x: 4, pdf: 0.005166746338523012, cdf: 0.9976611325094764 }
  ]
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
    { x: -6, pdf: 1.9002712520221784e-08, cdf: 1.8921786948382924e-09 },
    { x: -4, pdf: 0.002283140710063958, cdf: 0.0006179789893310933 },
    { x: -2, pdf: 0.0896870393670086, cdf: 0.06598803584531254 },
    { x: -0.5, pdf: 0.17778637369097208, cdf: 0.27692033409990896 },
    { x: 0, pdf: 0.18393972058572117, cdf: 0.36787944117144233 },
    { x: 2, pdf: 0.12732319002179124, cdf: 0.6922006275553464 },
    { x: 4, pdf: 0.05910247579657157, cdf: 0.8734230184931167 },
    { x: 6, pdf: 0.023684504838953954, cdf: 0.9514319929004534 },
    { x: 8, pdf: 0.008991614848356821, cdf: 0.9818510730616665 },
    { x: 10, pdf: 0.003346349838767757, cdf: 0.9932847020678415 },
    { x: 15, pdf: 0.0002763892762033169, cdf: 0.9994470685528181 }
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
  }],
  refVals: [
    { x: 0, pdf: 0.5, cdf: 0 },
    { x: 0.5, pdf: 0.47000742440318943, cdf: 0.24491866240370913 },
    { x: 1, pdf: 0.3932238664829637, cdf: 0.46211715726000974 },
    { x: 2, pdf: 0.20998717080701268, cdf: 0.7615941559557649 },
    { x: 3, pdf: 0.09035331946182434, cdf: 0.9051482536448665 },
    { x: 5, pdf: 0.013296113341580288, cdf: 0.9866142981514303 }
  ]
}, {
  name: 'HalfNormal',
  invalidParams: [
    [], // all params required
    [-1], [0] // sigma > 0
  ],
  cases: [{
    params: () => [2]
  }],
  refVals: [
    { x: 0, pdf: 0.3989422804014327, cdf: 0 },
    { x: 0.5, pdf: 0.3866681168028492, cdf: 0.19741265136584557 },
    { x: 1, pdf: 0.3520653267642995, cdf: 0.3829249225480263 },
    { x: 2, pdf: 0.24197072451914337, cdf: 0.6826894921370859 },
    { x: 3, pdf: 0.12951759566589174, cdf: 0.8663855974622837 },
    { x: 5, pdf: 0.017528300493568526, cdf: 0.9875806693484477 }
  ]
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
  }],
  refVals: [
    { x: 0.05, pdf: 0.453999297624848, cdf: 0.00276939571551158 },
    { x: 0.1, pdf: 4.21121687442842, cdf: 0.124652019483081 },
    { x: 0.2, pdf: 3.20644525874605, cdf: 0.54381311588333 },
    { x: 0.3, pdf: 1.45737347868489, cdf: 0.765995500396779 },
    { x: 0.5, pdf: 0.367879441171442, cdf: 0.919698602928606 },
    { x: 0.8, pdf: 0.0816744123106369, cdf: 0.974343069100974 },
    { x: 1.0, pdf: 0.0379081662320396, cdf: 0.985612322033029 },
    { x: 1.5, pdf: 0.00884606556263937, cdf: 0.995182375796929 },
    { x: 2.0, pdf: 0.00304219055887268, cdf: 0.997838503310237 }
  ]
}, {
  name: 'InverseGamma',
  invalidParams: [
    [], // all params required
    [-1, 1], [0, 1], // alpha > 0
    [1, -1], [1, 0] // beta > 0
  ],
  cases: [{
    params: () => [2, 2]
  }],
  refVals: [
    { x: 0.3, pdf: 0.188538340939231, cdf: 0.00975685914360519 },
    { x: 0.5, pdf: 0.586100444439494, cdf: 0.0915781944436709 },
    { x: 1, pdf: 0.541341132946451, cdf: 0.406005849709838 },
    { x: 1.5, pdf: 0.312411422951972, cdf: 0.615059988936696 },
    { x: 2, pdf: 0.183939720585721, cdf: 0.735758882342885 },
    { x: 3, pdf: 0.0760617954122358, cdf: 0.855695198387653 },
    { x: 4, pdf: 0.0379081662320396, cdf: 0.90979598956895 },
    { x: 5, pdf: 0.0214502414731405, cdf: 0.938448064449895 },
    { x: 8, pdf: 0.00608438111774535, cdf: 0.973500978839256 }
  ]
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
    { x: -8, pdf: 0.004578909722183545, cdf: 0.00915781944436709 },
    { x: -6, pdf: 0.01244676709196599, cdf: 0.02489353418393197 },
    { x: -3, pdf: 0.05578254003710745, cdf: 0.1115650800742149 },
    { x: -2, pdf: 0.09196986029286058, cdf: 0.18393972058572117 },
    { x: -1, pdf: 0.15163266492815836, cdf: 0.3032653298563167 },
    { x: 0, pdf: 0.25, cdf: 0.5 },
    { x: 1, pdf: 0.15163266492815836, cdf: 0.6967346701436833 },
    { x: 2, pdf: 0.09196986029286058, cdf: 0.8160602794142788 },
    { x: 3, pdf: 0.055782540037107455, cdf: 0.888434919925785 },
    { x: 6, pdf: 0.012446767091965986, cdf: 0.9751064658160681 },
    { x: 10, pdf: 0.0016844867497713668, cdf: 0.9966310265004573 }
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
    { x: -0.1, pdf: 0, cdf: 0 },
    { x: 0.05, pdf: 1.2993252326915459, cdf: 0.06708401667139786 },
    { x: 0.2, pdf: 0.7214919193824545, cdf: 0.2104909390487632 },
    { x: 0.5, pdf: 0.3756884160167712, cdf: 0.3644558447365357 },
    { x: 1, pdf: 0.19947114020071638, cdf: 0.5 },
    { x: 2, pdf: 0.09392210400419279, cdf: 0.6355441552634643 },
    { x: 5, pdf: 0.028859676775298194, cdf: 0.7895090609512367 },
    { x: 10, pdf: 0.010281510740412525, cdf: 0.8751940487591403 },
    { x: 20, pdf: 0.0032483130817288646, cdf: 0.9329159833286021 }
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
    { x: -10, pdf: 0.003324028335395076, cdf: 0.0066928509242848554 },
    { x: -5, pdf: 0.03505185827255408, cdf: 0.07585818002124355 },
    { x: -4, pdf: 0.05249679270175326, cdf: 0.11920292202211755 },
    { x: -2, pdf: 0.09830596662074093, cdf: 0.2689414213699951 },
    { x: -1, pdf: 0.11750185610079725, cdf: 0.3775406687981454 },
    { x: 0, pdf: 0.125, cdf: 0.5 },
    { x: 1, pdf: 0.1175018561007972, cdf: 0.6224593312018546 },
    { x: 2, pdf: 0.09830596662074093, cdf: 0.7310585786300049 },
    { x: 5, pdf: 0.035051858272554075, cdf: 0.9241418199787566 },
    { x: 8, pdf: 0.008831353106645555, cdf: 0.9820137900379085 },
    { x: 12, pdf: 0.0012332546456800236, cdf: 0.9975273768433653 }
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
  }],
  refVals: [
    { x: 0.05, pdf: 1.4208066041307614, cdf: 0.07048080803732944 },
    { x: 0.1, pdf: 1.2121376023332504, cdf: 0.13596860764142424 },
    { x: 0.25, pdf: 0.9148657916155941, cdf: 0.2913976857159183 },
    { x: 0.5, pdf: 0.7978845608028654, cdf: 0.5 },
    { x: 0.9, pdf: 1.2121376023332504, cdf: 0.8640313923585758 }
  ]
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
  }],
  refVals: [
    { x: 0, pdf: 0, cdf: 0 },
    { x: 0.2, pdf: 0.00396952547477012, cdf: 0.00026516505865561 },
    { x: 0.5, pdf: 0.0241667573001781, cdf: 0.00407859296442284 },
    { x: 1, pdf: 0.0880163316910749, cdf: 0.0308595957837268 },
    { x: 2, pdf: 0.241970724519143, cdf: 0.198748043098799 },
    { x: 3, pdf: 0.291414590248256, cdf: 0.477832810464609 },
    { x: 4, pdf: 0.215963866052752, cdf: 0.738535870050889 },
    { x: 5, pdf: 0.109551878084803, cdf: 0.899939166880605 },
    { x: 6, pdf: 0.0398866357074421, cdf: 0.970709113465112 },
    { x: 8, pdf: 0.00214128361223817, cdf: 0.998866015710215 }
  ]
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
  }],
  refVals: [
    { x: -2, pdf: 0.08448116845349869, cdf: 0.09920475041111473 },
    { x: 0, pdf: 0.12098536225957168, cdf: 0.31731050786291415 },
    { x: 1, pdf: 0.11470965943431939, cdf: 0.4360970763850289 },
    { x: 2, pdf: 0.10065812203244397, cdf: 0.5441624293623029 },
    { x: 4, pdf: 0.06858006697282189, cdf: 0.7129631304791878 },
    { x: 6, pdf: 0.04341374217804455, cdf: 0.8234342056094609 }
  ]
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
  }],
  refVals: [
    { x: 0, pdf: 0, cdf: 0 },
    { x: 0.3, pdf: 0.0190237319556786, cdf: 0.00117904884978179 },
    { x: 0.5, pdf: 0.120179894987858, cdf: 0.0131699868159875 },
    { x: 0.8, pdf: 0.483719049578578, cdf: 0.0987506554987263 },
    { x: 1, pdf: 0.753009969450755, cdf: 0.223504928876677 },
    { x: 1.2, pdf: 0.900873361567426, cdf: 0.391686707918531 },
    { x: 1.5, pdf: 0.799062287690592, cdf: 0.655566243225813 },
    { x: 1.8, pdf: 0.480691228296837, cdf: 0.849190137129875 },
    { x: 2, pdf: 0.283345553417345, cdf: 0.924764753853488 },
    { x: 2.5, pdf: 0.0415435134523703, cdf: 0.991999594318859 }
  ]
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
    { x: -6, pdf: 0.0022159242059690038, cdf: 0.0013498980316300933 },
    { x: -3, pdf: 0.06475879783294587, cdf: 0.06680720126885807 },
    { x: -1, pdf: 0.17603266338214973, cdf: 0.3085375387259869 },
    { x: 0, pdf: 0.19947114020071635, cdf: 0.5 },
    { x: 1, pdf: 0.17603266338214973, cdf: 0.6914624612740131 },
    { x: 3, pdf: 0.06475879783294587, cdf: 0.9331927987311419 },
    { x: 5, pdf: 0.008764150246784268, cdf: 0.9937903346742238 },
    { x: 7, pdf: 0.0004363413475228801, cdf: 0.9997673709209645 },
    { x: -10, pdf: 7.433597573671489e-7, cdf: 2.866515718680240354e-7 },
    { x: 10, pdf: 7.433597573671489e-7, cdf: 0.9999997133484281 },
    { x: -14, pdf: 4.567360204182298e-12, cdf: 1.279809591636649e-12 },
    { x: 14, pdf: 4.567360204182298e-12, cdf: 0.9999999999987202 }
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
    { x: 1.9, pdf: 0, cdf: 0 },
    { x: 2.1, pdf: 0.863837598531476, cdf: 0.09297052154195018 },
    { x: 2.5, pdf: 0.512, cdf: 0.36 },
    { x: 3, pdf: 0.2962962962962963, cdf: 0.5555555555555556 },
    { x: 4, pdf: 0.125, cdf: 0.75 },
    { x: 5, pdf: 0.064, cdf: 0.84 },
    { x: 8, pdf: 0.015625, cdf: 0.9375 },
    { x: 15, pdf: 0.0023703703703703703, cdf: 0.9822222222222222 },
    { x: 30, pdf: 0.0002962962962962963, cdf: 0.9955555555555555 }
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
  }],
  refVals: [
    { x: 0, pdf: 0, cdf: 0 },
    { x: 0.2, pdf: 0.0497506239596341, cdf: 0.00498752080731769 },
    { x: 0.5, pdf: 0.121154154309543, cdf: 0.0307667655236559 },
    { x: 1, pdf: 0.220624225646149, cdf: 0.117503097415405 },
    { x: 2, pdf: 0.303265329856317, cdf: 0.393469340287367 },
    { x: 3, pdf: 0.243489350518762, cdf: 0.67534753264165 },
    { x: 4, pdf: 0.135335283236613, cdf: 0.864664716763387 },
    { x: 5, pdf: 0.0549211670292593, cdf: 0.956063066376593 },
    { x: 6, pdf: 0.0166634948073635, cdf: 0.988891003461758 },
    { x: 8, pdf: 0.000670925255805024, cdf: 0.999664537372097 }
  ]
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
  }],
  refVals: [
    { x: 0.5, pdf: 0.0746363849795025, cdf: 0.018806393428795098 },
    { x: 1, pdf: 0.14231040705729825, cdf: 0.07347260204335199 },
    { x: 2, pdf: 0.23287980379682005, cdf: 0.26712019620317995 },
    { x: 3, pdf: 0.24319426642182998, cdf: 0.5119600008646987 },
    { x: 4, pdf: 0.18711975640531622, cdf: 0.7309879399640902 },
    { x: 6, pdf: 0.04932978263563178, cdf: 0.9562840284213637 }
  ]
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
  }],
  refVals: [
    { x: -4, pdf: 1.7099609572430577e-6, cdf: 3.143618030015566e-7 },
    { x: -2, pdf: 0.005504865910407027, cdf: 0.001718879945288876 },
    { x: 0, pdf: 0.19947114020071635, cdf: 0.14758361765043326 },
    { x: 1, pdf: 0.2962083129460479, cdf: 0.4083012539660558 },
    { x: 2, pdf: 0.23646585860873606, cdf: 0.6844083720823748 },
    { x: 4, pdf: 0.05398925655223084, cdf: 0.9545000504654455 }
  ]
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
  }],
  refVals: [
    { x: -6, pdf: 0.00426898476659902, cdf: 0.0133357366077124 },
    { x: -4, pdf: 0.0130945700219731, cdf: 0.0285954792089683 },
    { x: -2, pdf: 0.0680413817439772, cdf: 0.091751709536137 },
    { x: -1, pdf: 0.192450089729875, cdf: 0.211324865405187 },
    { x: 0, pdf: 0.353553390593274, cdf: 0.5 },
    { x: 1, pdf: 0.192450089729875, cdf: 0.788675134594813 },
    { x: 2, pdf: 0.0680413817439772, cdf: 0.908248290463863 },
    { x: 4, pdf: 0.0130945700219731, cdf: 0.971404520791032 },
    { x: 6, pdf: 0.00426898476659902, cdf: 0.986664263392288 }
  ]
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
  }],
  refVals: [
    { x: 0, pdf: 0.11579116302745622, cdf: 0 },
    { x: 1, pdf: 0.19090735344247414, cdf: 0.15338849914569627 },
    { x: 2, pdf: 0.24512989405272581, cdf: 0.37484941165022007 },
    { x: 2.5, pdf: 0.25291115216985416, cdf: 0.5 },
    { x: 3, pdf: 0.24512989405272581, cdf: 0.6251505883497799 },
    { x: 4, pdf: 0.19090735344247414, cdf: 0.8466115008543037 },
    { x: 5, pdf: 0.11579116302745622, cdf: 1 }
  ]
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
    { x: 4.9, pdf: 0, cdf: 0 },
    { x: 5.5, pdf: 0.05, cdf: 0.025 },
    { x: 7, pdf: 0.05, cdf: 0.1 },
    { x: 10, pdf: 0.05, cdf: 0.25 },
    { x: 13, pdf: 0.05, cdf: 0.4 },
    { x: 16, pdf: 0.05, cdf: 0.55 },
    { x: 20, pdf: 0.05, cdf: 0.75 },
    { x: 22, pdf: 0.05, cdf: 0.85 },
    { x: 24.5, pdf: 0.05, cdf: 0.975 },
    { x: 25.1, pdf: 0, cdf: 1 }
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
    { x: -0.1, pdf: 0, cdf: 0 },
    { x: 0.1, pdf: 0.049875156119873004, cdf: 0.002496877602539876 },
    { x: 0.5, pdf: 0.23485326570336895, cdf: 0.060586937186524206 },
    { x: 1, pdf: 0.38940039153570244, cdf: 0.22119921692859515 },
    { x: 1.5, pdf: 0.42733711854819223, cdf: 0.430217175269077 },
    { x: 2, pdf: 0.36787944117144233, cdf: 0.6321205588285577 },
    { x: 3, pdf: 0.1580988368427965, cdf: 0.8946007754381357 },
    { x: 4, pdf: 0.03663127777746836, cdf: 0.9816843611112658 },
    { x: 6, pdf: 0.0003702294122600387, cdf: 0.9998765901959134 }
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
