// Cross-validate the scipy/numpy refVals produced by scripts/refvals-issue-134.py
// against dist/ranjs.cjs.js. Exits non-zero if any (pmf, cdf) tuple disagrees
// by more than the checkRefVals tolerance (1e-10 relative for values >= 1e-10).
//
// Run after `npm run build` so dist/ranjs.cjs.js is current.

const r = require('../dist/ranjs.cjs.js')

const TOL = 1e-10

function tol (expected) {
  return Math.abs(expected) >= TOL
    ? TOL
    : Math.max(Math.abs(expected) * 1e-10, Number.MIN_VALUE)
}

// Mirror of the Python output. Keep these in sync with scripts/refvals-issue-134.py.
const TABLES = [
  {
    name: 'Binomial',
    make: () => new r.dist.Binomial(25, 0.5),
    refs: [
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
  },
  {
    name: 'Poisson',
    make: () => new r.dist.Poisson(10),
    refs: [
      { x: 2, pmf: 0.0022699964881242435, cdf: 0.0027693957155115775 },
      { x: 5, pmf: 0.03783327480207079, cdf: 0.06708596287903189 },
      { x: 8, pmf: 0.11259903214902009, cdf: 0.3328196787507191 },
      { x: 10, pmf: 0.12511003572113372, cdf: 0.5830397501929852 },
      { x: 12, pmf: 0.09478033009176803, cdf: 0.7915564763948745 },
      { x: 15, pmf: 0.034718069630684245, cdf: 0.9512595966960213 },
      { x: 20, pmf: 0.0018660813139987742, cdf: 0.998411739338142 },
      { x: 30, pmf: 1.7115717355368203e-07, cdf: 0.9999999201620534 }
    ]
  },
  {
    name: 'Geometric',
    make: () => new r.dist.Geometric(0.5),
    refs: [
      { x: 0, pmf: 0.4999999999999998, cdf: 0.5 },
      { x: 1, pmf: 0.25000000000000006, cdf: 0.75 },
      { x: 2, pmf: 0.12499999999999997, cdf: 0.875 },
      { x: 3, pmf: 0.06249999999999999, cdf: 0.9375 },
      { x: 5, pmf: 0.015624999999999988, cdf: 0.984375 },
      { x: 8, pmf: 0.0019531250000000035, cdf: 0.998046875 },
      { x: 12, pmf: 0.00012207031250000008, cdf: 0.9998779296875 }
    ]
  },
  {
    name: 'NegativeBinomial',
    // cases[0] is asymmetric (r=10, p=0.4) so the success/failure swap can't hide.
    make: () => new r.dist.NegativeBinomial(10, 0.4),
    refs: [
      { x: 0, pmf: 0.00604661760000001, cdf: 0.0060466176 },
      { x: 3, pmf: 0.085136375808, cdf: 0.168579698688 },
      { x: 5, pmf: 0.12395856317644793, cdf: 0.40321555041484797 },
      { x: 7, pmf: 0.11333354347560956, cdf: 0.6405076570669056 },
      { x: 10, pmf: 0.058570775268195, cdf: 0.8724787538527833 },
      { x: 15, pmf: 0.008488977840717116, cdf: 0.9868309265111141 },
      { x: 25, pmf: 3.570821815044619e-05, cdf: 0.9999592256410035 }
    ]
  },
  {
    name: 'Hypergeometric',
    make: () => new r.dist.Hypergeometric(30, 10, 5),
    refs: [
      { x: 0, pmf: 0.10879541914024672, cdf: 0.10879541914024672 },
      { x: 1, pmf: 0.33998568481327096, cdf: 0.44878110395351767 },
      { x: 2, pmf: 0.3599848427434634, cdf: 0.8087659466969812 },
      { x: 3, pmf: 0.15999326344153927, cdf: 0.9687592101385205 },
      { x: 4, pmf: 0.029472443265546714, cdf: 0.9982316534040672 },
      { x: 5, pmf: 0.0017683465959328027, cdf: 1.0 }
    ]
  },
  {
    name: 'Bernoulli',
    make: () => new r.dist.Bernoulli(0.5),
    refs: [
      { x: 0, pmf: 0.5000000000000001, cdf: 0.5 },
      { x: 1, pmf: 0.5, cdf: 1.0 }
    ]
  },
  {
    name: 'DiscreteUniform',
    make: () => new r.dist.DiscreteUniform(5, 50),
    refs: [
      { x: 5, pmf: 0.021739130434782608, cdf: 0.021739130434782608 },
      { x: 10, pmf: 0.021739130434782608, cdf: 0.13043478260869565 },
      { x: 20, pmf: 0.021739130434782608, cdf: 0.34782608695652173 },
      { x: 30, pmf: 0.021739130434782608, cdf: 0.5652173913043478 },
      { x: 40, pmf: 0.021739130434782608, cdf: 0.782608695652174 },
      { x: 50, pmf: 0.021739130434782608, cdf: 1.0 }
    ]
  },
  {
    name: 'Categorical',
    make: () => new r.dist.Categorical([0.4, 0.6], 0),
    refs: [
      { x: 0, pmf: 0.4, cdf: 0.4 },
      { x: 1, pmf: 0.6, cdf: 1.0 }
    ]
  }
]

let failed = 0
for (const t of TABLES) {
  const d = t.make()
  let maxErrPmf = 0
  let maxErrCdf = 0
  for (const { x, pmf, cdf } of t.refs) {
    const actualPmf = d.pdf(x)
    const actualCdf = d.cdf(x)
    const ePmf = Math.abs(actualPmf - pmf)
    const eCdf = Math.abs(actualCdf - cdf)
    if (ePmf >= tol(pmf)) {
      console.error(`FAIL ${t.name}: pmf(${x}) ranjs=${actualPmf} scipy=${pmf} err=${ePmf}`)
      failed++
    }
    if (eCdf >= tol(cdf)) {
      console.error(`FAIL ${t.name}: cdf(${x}) ranjs=${actualCdf} scipy=${cdf} err=${eCdf}`)
      failed++
    }
    maxErrPmf = Math.max(maxErrPmf, ePmf)
    maxErrCdf = Math.max(maxErrCdf, eCdf)
  }
  console.log(`OK   ${t.name.padEnd(18)} maxErr(pmf)=${maxErrPmf.toExponential(2)} maxErr(cdf)=${maxErrCdf.toExponential(2)}`)
}

if (failed > 0) {
  console.error(`\n${failed} disagreement(s) — refusing to embed.`)
  process.exit(1)
}
console.log('\nAll 8 distributions agree with scipy within 1e-10.')
