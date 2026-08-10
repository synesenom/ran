#!/usr/bin/env node
/**
 * CI gate for the differential-testing harness (issue #1267).
 *
 * scripts/difftest-special.py and scripts/difftest-dist.py never exit non-zero on their
 * own -- `npm run difftest:*` doubles as a plain local diagnostic run, and it should not
 * fail the shell just because an already-tracked, already-calibrated defect (e.g.
 * besselK's #1140 crossover) has an elevated ceiling. Failing the job on a ceiling breach
 * is a CI-only concern, so it lives here instead of in the harness scripts themselves.
 *
 * Reads the two JSON reports the harness scripts already produce, fails (non-zero exit)
 * if any function/distribution exceeds its declared ulp_ceiling, and writes a Markdown
 * summary naming the exact reproducer for every offender -- function/distribution,
 * parameter tuple, evaluation point, ranjs value, mpmath value, ULP distance -- per
 * #1267's "a red X with no reproducer is most of the cost of the failure" requirement.
 * Written to $GITHUB_STEP_SUMMARY when running in Actions, and stdout otherwise so a
 * local run is equally informative.
 *
 * Usage: node scripts/difftest-ci-gate.js [--special PATH] [--dist PATH]
 */
const fs = require('fs')

function flagValue (name, fallback) {
  const idx = process.argv.indexOf(name)
  return idx === -1 ? fallback : process.argv[idx + 1]
}

const SPECIAL_REPORT_PATH = flagValue('--special', '/tmp/difftest-special-report.json')
const DIST_REPORT_PATH = flagValue('--dist', '/tmp/difftest-dist-report.json')

function readReport (filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`report not found: ${filePath} (did the sweep step run?)`)
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function fmtValue (value) {
  return typeof value === 'number' ? value : String(value)
}

// argSpecs/values are parallel arrays (harness reports store args positionally, not as
// a name -> value map) -- pairing them by index is how generate-accuracy-docs.js's own
// fmtArgDomain reads the same domain shape.
function fmtArgs (argSpecs, values) {
  return argSpecs.map((spec, i) => `${spec.name}=${fmtValue(values[i])}`).join(', ')
}

// Both report shapes reduce to the same offender record; only reproducer formatting
// differs (special: flat arg list; dist: params list plus the sampled x), so the
// filter/map skeleton is factored out once instead of duplicated per report shape.
function collectOffenders (entries, source, reproducerOf) {
  return Object.entries(entries)
    .filter(([, data]) => data.ceiling_exceeded)
    .map(([key, data]) => ({
      source,
      entry: key,
      maxUlp: data.max_ulp,
      ceiling: data.ulp_ceiling,
      reproducer: `${reproducerOf(data)} → ranjs=${fmtValue(data.worst_case.ranjs_value)}, mpmath=${fmtValue(data.worst_case.mpmath_ref)}`
    }))
}

function specialOffenders (report) {
  return collectOffenders(report.functions, 'special',
    data => fmtArgs(data.domain, data.worst_case.args))
}

function distOffenders (report) {
  return collectOffenders(report.entries, 'dist',
    data => `${fmtArgs(data.domain.params, data.worst_case.params)}, x=${fmtValue(data.worst_case.x)}`)
}

function renderSummary (offenders) {
  const status = offenders.length === 0
    ? '✅ All entries within their declared ULP ceiling.'
    : `❌ ${offenders.length} entr${offenders.length === 1 ? 'y' : 'ies'} exceeded their declared ULP ceiling.`
  const lines = ['## Differential-testing accuracy gate', '', status]
  if (offenders.length > 0) {
    lines.push(
      '',
      '| Source | Entry | Max ULP | Ceiling | Reproducer |',
      '| --- | --- | --- | --- | --- |',
      ...offenders.map(o => `| ${o.source} | \`${o.entry}\` | ${fmtValue(o.maxUlp)} | ${fmtValue(o.ceiling)} | ${o.reproducer} |`)
    )
  }
  return lines.join('\n') + '\n'
}

function main () {
  const specialReport = readReport(SPECIAL_REPORT_PATH)
  const distReport = readReport(DIST_REPORT_PATH)
  const offenders = [...specialOffenders(specialReport), ...distOffenders(distReport)]

  const summary = renderSummary(offenders)
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
  }

  if (offenders.length > 0) {
    process.exitCode = 1
  }
}

if (require.main === module) {
  main()
}

module.exports = { specialOffenders, distOffenders, renderSummary, fmtArgs }
