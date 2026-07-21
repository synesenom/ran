// Monte Carlo validation of ran.dist.guess()'s soft pre-filters (issue #1054).
//
// Measures the empirical false-exclusion rate of the skewness, coefficient-of-variation, and
// dispersion-index filters (src/dist/guess.js) for one representative distribution per soft-
// filter family (src/dist/_guess-meta.js), across a range of realistic sample sizes.
//
// Run after `npm run build` so dist/ranjs.cjs.js is current:
//   node scripts/guess-filter-validation.js

const r = require('../dist/ranjs.cjs.js')

const DRAWS = 10000
const SAMPLE_SIZES = [50, 100, 200, 500, 1000]
// A rate this high is the issue's own "surprisingly high" bar for a soft filter that's
// meant to be a light, mostly-harmless prune ahead of the expensive fit() call.
const FLAG_THRESHOLD = 0.15

// Duplicated from src/dist/guess.js and src/dist/_guess-meta.js rather than imported: the
// predicates and the per-family threshold constants are module-private (only `guess` itself
// is exported), and exporting them just for this one-off validation script would be a
// production-code change outside this issue's investigate-and-document scope. If guess.js's
// filter logic or _guess-meta.js's SYMMETRIC constants ever change, this copy must be updated
// in lockstep — a future threshold-changing PR re-runs this script anyway, which is where
// that drift would surface.
const NORMAL_SKEWNESS_VARIANCE = 6
const SYMMETRIC_SKEWNESS_VARIANCE = {
  Normal: 6,
  Uniform: 72 / 35,
  Laplace: 63
}

function symmetricThreshold (familyKey, n) {
  return 2 * Math.sqrt(SYMMETRIC_SKEWNESS_VARIANCE[familyKey] / n)
}

function positiveSkewOnlyThreshold (n) {
  return 2 * Math.sqrt(NORMAL_SKEWNESS_VARIANCE / n)
}

function symmetricFails (skew, threshold) {
  return Math.abs(skew) > threshold
}

function positiveSkewOnlyFails (skew, threshold) {
  return skew < -threshold
}

function cvFails (cvValue) {
  return cvValue < 0.1 || cvValue > 10
}

function dispersionPoissonFails (vmrValue) {
  return vmrValue > 3
}

function dispersionNegBinomFails (vmrValue) {
  return vmrValue < 0.5
}

// Each handler pairs the data-context statistic guess.js's filter reads with the predicate
// that decides exclusion, keyed by the same filter name used in CONFIGS below — replaces a
// switch/case in measure() so adding or reusing a filter type is a table entry, not a branch.
// `symmetric`'s threshold is per-family (config.familyKey), not just per-n, since each
// SYMMETRIC member has its own asymptotic skewness-estimator variance (issue #1064).
const FILTER_HANDLERS = {
  symmetric: {
    statistic: r.shape.skewness,
    fails: (skew, n, config) => symmetricFails(skew, symmetricThreshold(config.familyKey, n))
  },
  positiveSkewOnly: {
    statistic: r.shape.skewness,
    fails: (skew, n) => positiveSkewOnlyFails(skew, positiveSkewOnlyThreshold(n))
  },
  cv: {
    statistic: r.dispersion.cv,
    fails: cvFails
  },
  dispersionPoisson: {
    statistic: r.dispersion.vmr,
    fails: dispersionPoissonFails
  },
  dispersionNegBinom: {
    statistic: r.dispersion.vmr,
    fails: dispersionNegBinomFails
  }
}

// One representative per family, plus a stress-case second member for the two families whose
// filter is skewness-based (SYMMETRIC, POSITIVE_SKEW_ONLY) and has more than one member. All
// three SYMMETRIC members are covered so each one's own per-family threshold is validated.
const CONFIGS = [
  {
    family: 'SYMMETRIC',
    name: 'Normal(0,1)',
    familyKey: 'Normal',
    filter: 'symmetric',
    factory: () => new r.dist.Normal(0, 1)
  },
  {
    family: 'SYMMETRIC',
    name: 'Uniform(-1,1)',
    familyKey: 'Uniform',
    filter: 'symmetric',
    factory: () => new r.dist.Uniform(-1, 1)
  },
  {
    family: 'SYMMETRIC',
    name: 'Laplace(0,1)',
    familyKey: 'Laplace',
    filter: 'symmetric',
    factory: () => new r.dist.Laplace(0, 1)
  },
  {
    family: 'POSITIVE_SKEW_ONLY',
    name: 'Exponential(1)',
    filter: 'positiveSkewOnly',
    factory: () => new r.dist.Exponential(1)
  },
  {
    family: 'POSITIVE_SKEW_ONLY',
    name: 'Gamma(20,1)',
    filter: 'positiveSkewOnly',
    factory: () => new r.dist.Gamma(20, 1)
  },
  {
    family: 'CV_ONE_FAMILY',
    name: 'Exponential(1)',
    filter: 'cv',
    factory: () => new r.dist.Exponential(1)
  },
  {
    family: 'POISSON_LIKE',
    name: 'Poisson(5)',
    filter: 'dispersionPoisson',
    factory: () => new r.dist.Poisson(5)
  },
  {
    family: 'NEGATIVE_BINOMIAL_LIKE',
    name: 'NegativeBinomial(5,0.5)',
    filter: 'dispersionNegBinom',
    factory: () => new r.dist.NegativeBinomial(5, 0.5)
  }
]

function measure (config, n) {
  const handler = FILTER_HANDLERS[config.filter]
  let excluded = 0
  let evaluated = 0
  for (let i = 0; i < DRAWS; i++) {
    const sample = config.factory().seed(`${config.family}-${config.name}-${n}-${i}`).sample(n)
    const stat = handler.statistic(sample)
    if (Number.isNaN(stat)) continue
    evaluated++
    if (handler.fails(stat, n, config)) excluded++
  }
  const rate = excluded / evaluated
  return { rate, ...wilsonInterval(rate, evaluated), evaluated }
}

// Wilson score interval, not the plain Wald `rate ± z·SE` interval: several configurations
// below measure a true rate near 0 (the CV/dispersion filters), where Wald degenerates to
// exactly ±0 at excluded=0 and so understates the real uncertainty — Wilson stays valid at
// the boundary and gives a non-zero upper bound (~rule-of-three) even for a zero count.
// solutions/testing/2026-07-21-1131-wald-ci-degenerate-at-zero-wilson-score-fix.md
function wilsonInterval (rate, n) {
  const Z = 1.96
  const z2 = Z * Z
  const denom = 1 + z2 / n
  const center = (rate + z2 / (2 * n)) / denom
  const halfWidth = (Z * Math.sqrt(rate * (1 - rate) / n + z2 / (4 * n * n))) / denom
  return { ciLow: Math.max(0, center - halfWidth), ciHigh: Math.min(1, center + halfWidth) }
}

const SKEWNESS_FILTERS = new Set(['symmetric', 'positiveSkewOnly'])
const TARGET_RATE = 0.05

// Issue #1064's acceptance bar for SYMMETRIC configs specifically: Normal must stay at or
// below its pre-existing ~5%-target tolerance, while any other (heavier-tailed) SYMMETRIC
// member gets a looser bound to account for the asymptotic threshold formula's weaker
// accuracy away from normality, especially at small n. Not applied to other filter kinds —
// those are out of scope for this issue and keep their existing informal 5%-target display.
function acceptanceBound (config) {
  if (config.filter !== 'symmetric') return null
  return config.familyKey === 'Normal' ? 0.06 : 0.10
}

let flagCount = 0
let acceptanceFailCount = 0
console.log(`Monte Carlo soft-filter false-exclusion validation (${DRAWS} draws per configuration)\n`)
console.log(
  'family'.padEnd(24) +
  'distribution'.padEnd(20) +
  'n'.padEnd(8) +
  'rate'.padEnd(12) +
  '95% CI'.padEnd(18) +
  'vs 5% target (skewness filters only)'
)

CONFIGS.forEach(config => {
  SAMPLE_SIZES.forEach(n => {
    const { rate, ciLow, ciHigh, evaluated } = measure(config, n)
    const flagged = rate > FLAG_THRESHOLD
    if (flagged) flagCount++

    const bound = acceptanceBound(config)
    const acceptanceFailed = bound !== null && rate > bound
    if (acceptanceFailed) acceptanceFailCount++

    const targetCol = SKEWNESS_FILTERS.has(config.filter)
      ? `Δ=${((rate - TARGET_RATE) * 100).toFixed(2)}pp`
      : ''

    const line =
      config.family.padEnd(24) +
      config.name.padEnd(20) +
      String(n).padEnd(8) +
      `${(rate * 100).toFixed(2)}%`.padEnd(12) +
      `[${(ciLow * 100).toFixed(2)}%, ${(ciHigh * 100).toFixed(2)}%]`.padEnd(18) +
      targetCol +
      (evaluated < DRAWS ? ` (${DRAWS - evaluated} NaN draws skipped)` : '') +
      (flagged ? ' FLAGGED' : '') +
      (acceptanceFailed ? ` ISSUE-1064-ACCEPTANCE-FAIL(>${(bound * 100).toFixed(0)}%)` : '')
    console.log(line)
  })
})

console.log(`\n${flagCount === 0 ? 'No' : flagCount} configuration(s) exceeded the ${(FLAG_THRESHOLD * 100).toFixed(0)}% flag threshold.`)
console.log(`${acceptanceFailCount === 0 ? 'All' : acceptanceFailCount + ' of the'} SYMMETRIC configuration(s) meet issue #1064's acceptance bound (Normal <=6%, other SYMMETRIC members <=10%).`)
