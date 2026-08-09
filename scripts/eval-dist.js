// Bridges difftest-dist.py's randomly-drawn (distribution, params, p) triples into ranjs's own
// src/dist/ implementation -- @babel/register loads the ESM module the same way mocha does,
// mirroring eval-special.js. q(p) is evaluated here (not mpmath-side) so x lands in the
// distribution's interior without an mpmath bisection per point -- see the "x-sampling" decision
// in thoughts/plans/2026-08-09-1705-distribution-difftest-harness-pilot.md.
require('@babel/register').default()

const dist = require('../src/dist/index.js')

// Whitelist (mirrors difftest-dist.py's DIST_SPEC keys): indexing `dist` directly with the
// JSON-supplied name would let a caller instantiate any export -- see eval-special.js's FN.
const DISTS = { Gamma: dist.Gamma, Beta: dist.Beta, Chi2: dist.Chi2, F: dist.F, StudentT: dist.StudentT, InverseGamma: dist.InverseGamma }

// JSON has no Infinity/NaN literal (JSON.stringify silently emits `null` for both), so encode
// them as tagged strings the Python side decodes explicitly instead of losing the distinction.
function encode (value) {
  if (Number.isNaN(value)) return 'NaN'
  if (value === Infinity) return 'Infinity'
  if (value === -Infinity) return '-Infinity'
  return value
}

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  const points = JSON.parse(input)
  const results = points.map(({ dist: name, params, p }) => {
    try {
      // .seed(0): every fresh instance owns an unseeded PRNG no external seed reaches (see
      // solutions/testing/2026-08-01-1000-cramervonmises-prng-race-scan-1172.md); here
      // _qInitialGuess() draws from it for any distribution without fully bounded support.
      const instance = new DISTS[name](...params).seed(0)
      const x = instance.q(p)
      return {
        x: encode(x),
        pdf: encode(instance.pdf(x)),
        cdf: encode(instance.cdf(x))
      }
    } catch (ex) {
      return { error: String(ex) }
    }
  })
  process.stdout.write(JSON.stringify(results))
})
