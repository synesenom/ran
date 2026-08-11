// Bridges difftest-quantile.py's catalog and (distribution, params, p) evaluation requests into
// ranjs's own src/dist/ implementation -- @babel/register loads the ESM module the same way
// mocha does, mirroring eval-dist.js. Catalog mode enumerates every distribution's canonical
// valid parameter tuple, type, closed-form-vs-numerical quantile status, and support bounds
// straight from the same test/dist-cases-*.js entries scripts/dump-dist-cases-json.js already
// reads, so the population can never drift from what CLAUDE.md requires every distribution to
// have (a params()-bearing case entry) as new distributions are added.
require('@babel/register').default()

const dist = require('../src/dist/index.js')
const continuousCases = require('../test/dist-cases-continuous.js').default
const discreteCases = require('../test/dist-cases-discrete.js').default

// JSON has no Infinity/NaN literal (JSON.stringify silently emits `null` for both), so encode
// them as tagged strings the Python side decodes explicitly instead of losing the distinction.
function encode (value) {
  if (Number.isNaN(value)) return 'NaN'
  if (value === Infinity) return 'Infinity'
  if (value === -Infinity) return '-Infinity'
  return value
}

// typeof instance._q === 'function' is the runtime source of truth for closed-form-vs-numerical
// quantile dispatch (src/dist/_distribution.js's q(p)) -- only readable from JS, never from a
// static Python-side list, since a distribution's own _q override is what q() checks directly.
function catalogEntry (name, params) {
  const instance = new dist[name](...params).seed(0)
  return {
    name,
    params,
    type: instance.type(),
    hasClosedFormQ: typeof instance._q === 'function',
    support: instance.support().map(b => ({ closed: b.closed, value: encode(b.value) }))
  }
}

function catalog () {
  return [...continuousCases, ...discreteCases].map(({ name, cases }) => {
    try {
      return catalogEntry(name, cases[0].params())
    } catch (ex) {
      return { name, error: String(ex) }
    }
  })
}

function evalPoints (points) {
  return points.map(({ name, params, p }) => {
    try {
      const instance = new dist[name](...params).seed(0)
      const x = instance.q(p)
      return { x: encode(x), cdfOfQ: encode(instance.cdf(x)) }
    } catch (ex) {
      return { error: String(ex) }
    }
  })
}

const mode = process.argv[2]
if (mode === 'catalog') {
  process.stdout.write(JSON.stringify(catalog()))
} else if (mode === 'eval') {
  let input = ''
  process.stdin.on('data', chunk => { input += chunk })
  process.stdin.on('end', () => {
    process.stdout.write(JSON.stringify(evalPoints(JSON.parse(input))))
  })
} else {
  throw new Error(`Unknown mode "${mode}" -- expected "catalog" or "eval"`)
}
