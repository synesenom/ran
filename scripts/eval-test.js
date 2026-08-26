// Bridges precision-refs-test.py's R-computed (and, for hsic, from-scratch Python-computed)
// grid into ranjs's own src/test/ implementation -- @babel/register lets require() load the
// ESM-syntax module the same way mocha does, mirroring the eval-summary-stats.js precedent.
require('@babel/register').default()

const test = require('../src/test/index.js')
const dist = require('../src/dist/index.js')

const FN = {
  andersonDarling: test.andersonDarling,
  bartlett: test.bartlett,
  brownForsythe: test.brownForsythe,
  cramerVonMises: test.cramerVonMises,
  hsic: test.hsic,
  kolmogorovSmirnov: test.kolmogorovSmirnov,
  levene: test.levene,
  mannWhitney: test.mannWhitney,
  welch: test.welch
}

// Whitelist (mirrors precision-refs-test.py's CDF-distribution grid, currently Normal only):
// indexing `dist` directly with the JSON-supplied cdfSpec.dist name would let a job instantiate
// any export -- see eval-dist.js's DISTS for the same pattern.
const CDF_DISTS = { Normal: dist.Normal }

// JSON has no Infinity/NaN literal (JSON.stringify silently emits `null` for both), so encode
// them as tagged strings the Python side decodes explicitly instead of losing the distinction.
// src/test/* functions return an object ({stat, passed} or {stat, pValue, passed}), not a bare
// scalar, so encode is applied per-field rather than to a single return value.
function encode (value) {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN'
    if (value === Infinity) return 'Infinity'
    if (value === -Infinity) return '-Infinity'
    return value
  }
  return value
}

function encodeResult (result) {
  const encoded = {}
  Object.keys(result).forEach(key => { encoded[key] = encode(result[key]) })
  return encoded
}

// andersonDarling/cramerVonMises take a CDF *function*, which JSON cannot carry -- a job may
// instead supply cdfSpec ({dist, params}) naming a ran.dist constructor, and the actual
// `x => instance.cdf(x)` closure is built here, matching how a real caller would invoke these
// tests (e.g. the andersonDarling JSDoc example: `ran.test.andersonDarling(normal.sample(100),
// x => normal.cdf(x))`) -- this also means these two references are checked against the live
// dist/ CDF, not a frozen copy of it, consistently with every other src/test/ function here.
function buildArgs (job) {
  if (!job.cdfSpec) return job.args
  const instance = new CDF_DISTS[job.cdfSpec.dist](...job.cdfSpec.params)
  return [...job.args, x => instance.cdf(x)]
}

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  const jobs = JSON.parse(input)
  const results = jobs.map(job => {
    try {
      return { value: encodeResult(FN[job.fn](...buildArgs(job))) }
    } catch (ex) {
      return { error: String(ex) }
    }
  })
  process.stdout.write(JSON.stringify(results))
})
