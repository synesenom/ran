// Bridges precision-refs-summary-stats.py's mpmath-computed grid into ranjs's own
// src/location/, src/dispersion/, src/shape/, src/dependence/ implementations --
// @babel/register lets require() load the ESM-syntax modules the same way mocha does,
// mirroring the eval-special.js precedent.
require('@babel/register').default()

const location = require('../src/location/index.js')
const dispersion = require('../src/dispersion/index.js')
const shape = require('../src/shape/index.js')
const dependence = require('../src/dependence/index.js')

const FN = {
  geometricMean: location.geometricMean,
  harmonicMean: location.harmonicMean,
  mean: location.mean,
  median: location.median,
  midrange: location.midrange,
  mode: location.mode,
  trimean: location.trimean,
  cv: dispersion.cv,
  dVar: dispersion.dVar,
  entropy: dispersion.entropy,
  gini: dispersion.gini,
  iqr: dispersion.iqr,
  md: dispersion.md,
  midhinge: dispersion.midhinge,
  qcd: dispersion.qcd,
  range: dispersion.range,
  rmd: dispersion.rmd,
  stdev: dispersion.stdev,
  variance: dispersion.variance,
  vmr: dispersion.vmr,
  kurtosis: shape.kurtosis,
  moment: shape.moment,
  quantile: shape.quantile,
  rank: shape.rank,
  skewness: shape.skewness,
  yule: shape.yule,
  covariance: dependence.covariance,
  dCov: dependence.dCov,
  dCor: dependence.dCor,
  kendall: dependence.kendall,
  kullbackLeibler: dependence.kullbackLeibler,
  oddsRatio: dependence.oddsRatio,
  pearson: dependence.pearson,
  pointBiserial: dependence.pointBiserial,
  somersD: dependence.somersD,
  spearman: dependence.spearman,
  yuleQ: dependence.yuleQ,
  yuleY: dependence.yuleY
}

// JSON has no Infinity/NaN literal (JSON.stringify silently emits `null` for both), so encode
// them as tagged strings the Python side decodes explicitly instead of losing the distinction.
// `mode`'s discrete branch returns an array, not a scalar -- encode element-wise.
function encode (value) {
  if (Array.isArray(value)) return value.map(encode)
  if (Number.isNaN(value)) return 'NaN'
  if (value === Infinity) return 'Infinity'
  if (value === -Infinity) return '-Infinity'
  return value
}

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  const points = JSON.parse(input)
  const results = points.map(({ fn, args }) => {
    try {
      return { value: encode(FN[fn](...args)) }
    } catch (ex) {
      return { error: String(ex) }
    }
  })
  process.stdout.write(JSON.stringify(results))
})
