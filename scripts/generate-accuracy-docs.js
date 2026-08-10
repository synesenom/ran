#!/usr/bin/env node
/**
 * Renders docs/accuracy.md from the differential-testing harness JSON reports
 * (scripts/difftest-special.py, scripts/difftest-dist.py -- issue #1264/#1265).
 *
 * Every function/distribution the library exports is listed, whether or not it has been
 * swept: entries with no matching report data render as an explicit "not yet measured"
 * row rather than being silently omitted (#1266's "honest gaps" requirement). Domain
 * bounds are read straight out of the report JSON's `domain` field, which the harness
 * scripts populate directly from their own sweep spec -- so this generator can only ever
 * describe what was actually measured, never a stale or aspirational claim.
 *
 * Usage: npm run accuracy:docs
 *   (or) node scripts/generate-accuracy-docs.js [--special PATH] [--dist PATH] [--out PATH]
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

function flagValue (name, fallback) {
  const idx = process.argv.indexOf(name)
  return idx === -1 ? fallback : process.argv[idx + 1]
}

const SPECIAL_REPORT_PATH = flagValue('--special', '/tmp/difftest-special-report.json')
const DIST_REPORT_PATH = flagValue('--dist', '/tmp/difftest-dist-report.json')
const OUT_PATH = flagValue('--out', path.join(root, 'docs/accuracy.md'))

// Known, tracked accuracy defects the sweeps surface. Named explicitly so the table can
// never round a bad measured value away into a bare "OK" -- #1266's design constraint.
const KNOWN_ISSUES = {
  besselK: 1140,
  besselKnu: 1140,
  'Gamma.pdf': 1363,
  'InverseGamma.pdf': 1364
}

function readReport (filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function gitCommit () {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim()
  } catch {
    // Not fatal -- a report generated outside a git checkout still gets a useful
    // provenance header, just without a commit pin.
    return 'unknown'
  }
}

// ─── REGISTRY ─── the full set of names each report is measured against, so coverage
// gaps are computed from what the library actually exports, not hand-maintained here.
function extractDistributionNames () {
  const src = fs.readFileSync(path.join(root, 'src/dist/index.js'), 'utf8')
  const names = [...src.matchAll(/^export \{ default as (\w+) \} from/gm)].map(m => m[1])
  // Fail loud rather than silently render a table missing rows if the export-line
  // syntax in src/dist/index.js ever changes and breaks this regex (#1266).
  if (!names.includes('Gamma')) {
    throw new Error('extractDistributionNames(): sanity check failed -- expected canary distribution "Gamma" not found, regex may be broken')
  }
  return names
}

function extractSpecialFunctionNames () {
  const src = fs.readFileSync(path.join(root, 'src/special/index.js'), 'utf8')
  const names = []
  for (const m of src.matchAll(/^export \{([^}]+)\} from/gm)) {
    for (const token of m[1].split(',')) {
      const trimmed = token.trim()
      const alias = trimmed.match(/^default as (\w+)$/)
      names.push(alias ? alias[1] : trimmed)
    }
  }
  // Fail loud rather than silently render a table missing rows if the export-line
  // syntax in src/special/index.js ever changes and breaks this regex (#1266).
  if (!names.includes('digamma')) {
    throw new Error('extractSpecialFunctionNames(): sanity check failed -- expected canary function "digamma" not found, regex may be broken')
  }
  return names
}

// ─── FORMATTING ───
function fmtUlp (value) {
  if (value === null || value === undefined) return '—'
  if (!isFinite(value)) return '∞'
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function fmtArgDomain (arg) {
  const kind = arg.kind === 'int' ? ' (int)' : arg.log_uniform ? ' (log-uniform)' : ''
  return `${arg.name} ∈ [${arg.lo}, ${arg.hi}]${kind}`
}

function fmtSpecialDomain (domain) {
  return domain.map(fmtArgDomain).join('; ')
}

function fmtDistDomain (domain) {
  const params = domain.params.map(fmtArgDomain).join('; ')
  const [pLo, pHi] = domain.x_via_quantile_of_p
  return `${params}; x = q(p), p ∈ [${pLo}, ${pHi}]`
}

// Composes every applicable flag rather than the first-match-wins a plain if/else chain
// would give -- a known-issue link must never hide a newly-appeared divergence or thrown
// error on the same entry, and a thrown error (the harness eval crashed outright) is a
// distinct failure mode from a divergence (a value came back, it just disagreed with
// mpmath) or a plain ceiling breach, so all three must be able to show simultaneously.
// Each flag gets an emoji chosen for what it means, not an arbitrary severity color, so
// the failure mode reads at a glance without parsing the text: 💥 the eval itself crashed;
// ❌ a value came back but it's NaN/nonsensical against mpmath; ⚠️ a real, finite value
// that's merely worse than its calibrated ceiling; 🔗 a pointer to an already-tracked,
// non-new problem. Still ordered by severity in the array push order below.
function statusFor (key, data) {
  const flags = []
  if (data.errors > 0) {
    flags.push(`💥 ${data.errors} thrown error(s) on valid input (harness eval failed)`)
  }
  if (data.divergences > 0) {
    flags.push(`❌ ${data.divergences} divergence(s) (NaN/mismatch vs. mpmath)`)
  }
  if (data.ceiling_exceeded) {
    flags.push(`⚠️ CEILING EXCEEDED (ceiling ${data.ulp_ceiling})`)
  }
  if (KNOWN_ISSUES[key]) {
    flags.push(`🔗 known accuracy gap — tracked: [#${KNOWN_ISSUES[key]}](https://github.com/synesenom/ran/issues/${KNOWN_ISSUES[key]})`)
  }
  return flags.length > 0 ? flags.join('; ') : `✅ OK (ceiling ${data.ulp_ceiling})`
}

function measuredRow (key, label, domainText, data) {
  return `| \`${label}\` | ${domainText} | ${data.n} | ${fmtUlp(data.max_ulp)} | ${fmtUlp(data.median_ulp)} | ${statusFor(key, data)} |`
}

function unmeasuredRow (label) {
  return `| \`${label}\` | — | — | — | — | not yet measured |`
}

// ─── SECTIONS ───
function specialSection (report) {
  const allNames = extractSpecialFunctionNames()
  const functions = report ? report.functions : {}
  const rows = allNames.map(name =>
    functions[name]
      ? measuredRow(name, name, fmtSpecialDomain(functions[name].domain), functions[name])
      : unmeasuredRow(name)
  )
  return [
    '| Function | Domain swept | Samples | Max ULP | Median ULP | Status |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows
  ].join('\n')
}

function distSection (report) {
  const allNames = extractDistributionNames()
  const entries = report ? report.entries : {}
  const byDist = new Map()
  for (const key of Object.keys(entries)) {
    const [dist] = key.split('.')
    if (!byDist.has(dist)) byDist.set(dist, [])
    byDist.get(dist).push(key)
  }
  const rows = []
  for (const name of allNames) {
    const keys = byDist.get(name)
    if (!keys) {
      rows.push(unmeasuredRow(`${name}.pdf/pmf, cdf`))
      continue
    }
    for (const key of keys) {
      rows.push(measuredRow(key, key, fmtDistDomain(entries[key].domain), entries[key]))
    }
  }
  return [
    '| Distribution.method | Domain swept | Samples | Max ULP | Median ULP | Status |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows
  ].join('\n')
}

function totalSamples (report, key) {
  if (!report) return 0
  return Object.values(report[key]).reduce((sum, entry) => sum + entry.n, 0)
}

function provenanceRow (label, command, report, key) {
  if (!report) return `| ${label} (\`${command}\`) | — | — | — | not yet run |`
  return `| ${label} (\`${command}\`) | ${report.mpmath_version} | ${report.mp_dps} | ${report.seed} | ${totalSamples(report, key)} |`
}

// ─── MAIN ───
function main () {
  const specialReport = readReport(SPECIAL_REPORT_PATH)
  const distReport = readReport(DIST_REPORT_PATH)

  const md = `# Numerical Accuracy Bounds

Measured accuracy of ranjs's special functions and distribution \`pdf\`/\`pmf\`/\`cdf\`
methods, in [ULP](https://en.wikipedia.org/wiki/Unit_in_the_last_place) against
[mpmath](https://mpmath.org/) arbitrary-precision reference values. Generated by
[\`scripts/generate-accuracy-docs.js\`](../scripts/generate-accuracy-docs.js) from the
differential-testing harness reports ([ADR-0052](../decisions/0052-differential-testing-harness-live-mpmath-out-of-band.md),
[ADR-0053](../decisions/0053-accuracy-docs-committed.md)) -- never hand-edited.

Regenerate with:

\`\`\`bash
npm run accuracy
\`\`\`

This bounds table states what has been **measured**, not what is aspirational: an entry
absent from a sweep appears below as "not yet measured", and a defect the sweep found
appears with its actual bad value and a link to the tracking issue, never rounded away
or hidden.

## Provenance

| Report | mpmath | mp.dps | Seed | Total samples |
| --- | --- | --- | --- | --- |
${provenanceRow('Special functions', 'npm run accuracy:special', specialReport, 'functions')}
${provenanceRow('Distribution pdf/cdf', 'npm run accuracy:dist', distReport, 'entries')}

ranjs version measured: \`${pkg.version}\` (commit \`${gitCommit()}\`).

## Special Functions

${specialSection(specialReport)}

## Distribution pdf/pmf/cdf

${distSection(distReport)}
`

  fs.writeFileSync(OUT_PATH, md)
  console.log(`Wrote ${OUT_PATH}`)
}

main()
