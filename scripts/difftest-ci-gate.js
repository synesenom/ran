#!/usr/bin/env node
/**
 * CI gate for the differential-testing harness (issue #1267).
 *
 * scripts/difftest-special.py and scripts/difftest-dist.py never exit non-zero on their
 * own -- `npm run difftest:*` doubles as a plain local diagnostic run, and it should not
 * fail the shell just because an already-tracked, already-calibrated defect has an
 * elevated ceiling. Failing the job on a ceiling breach is a CI-only concern, so it lives
 * here instead of in the harness scripts themselves.
 *
 * Reads the two JSON reports the harness scripts already produce, fails (non-zero exit)
 * if any function/distribution exceeds its declared ulp_ceiling, throws a divergence
 * (max_ulp === Infinity is deliberately excluded from ceiling_exceeded -- see
 * ulp_diff's docstring -- so a NaN/Infinity mismatch against a finite mpmath reference
 * would otherwise stay invisible to this gate), or throws an outright eval error
 * (#1369) -- except for the KNOWN_ISSUES allowlist below, which keeps already-tracked
 * divergence sources from turning the scheduled job permanently red. Writes a
 * Markdown summary naming the exact reproducer for every offender -- function/
 * distribution, parameter tuple, evaluation point, ranjs value, mpmath value, ULP
 * distance -- per #1267's "a red X with no reproducer is most of the cost of the
 * failure" requirement. Written to $GITHUB_STEP_SUMMARY when running in Actions, and
 * stdout otherwise so a local run is equally informative.
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

// Known, tracked divergence sources -- mirrors generate-accuracy-docs.js's own
// KNOWN_ISSUES map. Unlike that map (a docs page, informational only), this one actually
// suppresses the gate's exit code so an already-accepted defect doesn't turn the
// scheduled job permanently red; entries here still get collected as offenders (see
// collectOffenders) and listed in the summary table so a reviewer never has to guess why
// a row disappeared. `InverseGamma.pdf` (#1364), `Gamma.pdf` (#1363), and besselK/
// besselKnu's #1140 crossover were previously tracked here too; all underlying issues are
// now resolved and a fresh differential-testing sweep confirmed all are clean, so their
// entries were removed. Empty until a new, genuinely tracked divergence source appears.
//
// `reasons` (when an entry exists) scopes the suppression to the specific failure
// reason(s) that were originally accepted for that entry (issue #1372) -- not to the
// entry name as a whole, so a newly-appeared, non-allowlisted reason on the same key
// still fails the gate. Values match the reason keys produced by offenderReasons().
const KNOWN_ISSUES = {}

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

// Composes every applicable reason rather than a first-match-wins if/else chain -- an
// entry can be both a divergence source and a ceiling breach at once, and collapsing
// that to one flag would hide the other from the reproducer table. divergences/errors
// are checked ahead of ceiling_exceeded because they are the more severe failure modes
// (issue #1369): a thrown eval or a NaN/Infinity mismatch against a finite mpmath
// reference, versus a merely elevated-but-finite ULP distance.
//
// Each reason carries a `key` alongside its display `text` -- KNOWN_ISSUES allowlists by
// this key (issue #1372) so a per-reason gate-failure check is possible instead of an
// entry-wide one.
function offenderReasons (data) {
  const reasons = []
  if (data.errors > 0) {
    reasons.push({ key: 'errors', text: `💥 ${data.errors} eval error(s)` })
  }
  if (data.divergences > 0) {
    reasons.push({ key: 'divergences', text: `❌ ${data.divergences} divergence(s) (NaN/Infinity vs. finite mpmath reference)` })
  }
  if (data.ceiling_exceeded) {
    reasons.push({ key: 'ceiling', text: `⚠️ ceiling exceeded (max ULP ${fmtValue(data.max_ulp)} > ${fmtValue(data.ulp_ceiling)})` })
  }
  return reasons
}

// Both report shapes reduce to the same offender record; only reproducer formatting
// differs (special: flat arg list; dist: params list plus the sampled x), so the
// filter/map skeleton is factored out once instead of duplicated per report shape.
//
// `reasons`/`reasonKeys` stay parallel arrays (rather than keeping the {key, text} pairs
// together) so existing consumers of `.reasons` -- a plain array of display strings --
// are unaffected by the #1372 per-reason allowlisting; `allowlistedReasonKeys` is the
// subset of `reasonKeys` this entry has tracked-issue coverage for, used by isGateFailure
// and renderSummary to tell a suppressed reason from a newly-appeared one on the same key.
function collectOffenders (entries, source, reproducerOf, knownIssues = KNOWN_ISSUES) {
  return Object.entries(entries)
    .map(([key, data]) => ({ key, data, reasons: offenderReasons(data) }))
    .filter(({ reasons }) => reasons.length > 0)
    .map(({ key, data, reasons }) => {
      const allowlist = knownIssues[key] || null
      return {
        source,
        entry: key,
        maxUlp: data.max_ulp,
        ceiling: data.ulp_ceiling,
        reasons: reasons.map(r => r.text),
        reasonKeys: reasons.map(r => r.key),
        allowlistedReasonKeys: allowlist ? allowlist.reasons : [],
        knownIssue: allowlist ? allowlist.issue : null,
        reproducer: `${reproducerOf(data)} → ranjs=${fmtValue(data.worst_case.ranjs_value)}, mpmath=${fmtValue(data.worst_case.mpmath_ref)}`
      }
    })
}

// A reason is suppressed only if its own key is in the entry's allowlisted reasons
// (issue #1372) -- an entry allowlisted for e.g. divergences still fails the gate if it
// develops an unrelated, non-allowlisted reason (e.g. eval errors) on the same key.
function isGateFailure (offender) {
  return offender.reasonKeys.some(key => !offender.allowlistedReasonKeys.includes(key))
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
  const failing = offenders.filter(isGateFailure)
  const allowlisted = offenders.filter(o => !isGateFailure(o))
  const status = failing.length === 0
    ? '✅ All entries within their declared ULP ceiling, with no new divergences or eval errors.'
    : `❌ ${failing.length} entr${failing.length === 1 ? 'y' : 'ies'} failed the gate (ceiling breach, divergence, or eval error).`
  const lines = ['## Differential-testing accuracy gate', '', status]
  if (allowlisted.length > 0) {
    lines.push('', `ℹ️ ${allowlisted.length} entr${allowlisted.length === 1 ? 'y is' : 'ies are'} allowlisted as known, tracked issues and did not count toward the failure above.`)
  }
  if (offenders.length > 0) {
    lines.push(
      '',
      '| Source | Entry | Max ULP | Ceiling | Reason | Reproducer |',
      '| --- | --- | --- | --- | --- | --- |',
      ...offenders.map(o => {
        // Annotated per reason, not per entry (issue #1372) -- a mixed entry (one
        // allowlisted reason, one newly-appeared one) must show the two differently
        // rather than either hiding the new failure or over-suppressing it in the table.
        const reason = o.reasons.map((text, i) => {
          const allowlistedReason = o.allowlistedReasonKeys.includes(o.reasonKeys[i])
          return allowlistedReason
            ? `${text} (🔗 allowlisted — tracked: [#${o.knownIssue}](https://github.com/synesenom/ran/issues/${o.knownIssue}))`
            : text
        }).join('; ')
        return `| ${o.source} | \`${o.entry}\` | ${fmtValue(o.maxUlp)} | ${fmtValue(o.ceiling)} | ${reason} | ${o.reproducer} |`
      })
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

  if (offenders.some(isGateFailure)) {
    process.exitCode = 1
  }
}

if (require.main === module) {
  main()
}

module.exports = { specialOffenders, distOffenders, renderSummary, fmtArgs, isGateFailure, collectOffenders }
