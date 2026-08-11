const { assert } = require('chai')
const { describe, it } = require('mocha')
const { specialOffenders, distOffenders, renderSummary, fmtArgs, isGateFailure, collectOffenders } = require('../../scripts/difftest-ci-gate')

// Fixtures are shaped exactly like scripts/difftest-special.py's build_report() output
// (functions keyed by name, each entry's domain a positional list of {name, ...} specs,
// worst_case.args positional to match domain) -- a field-name/shape drift here is exactly
// the silent regression #1267 is guarding against, so the shape must mirror the producer,
// not just satisfy whatever difftest-ci-gate.js currently reads.
const SPECIAL_REPORT = {
  seed: 1234,
  mpmath_version: '1.3.0',
  mp_dps: 50,
  functions: {
    besselJ: {
      n: 100,
      errors: 0,
      divergences: 0,
      max_ulp: 3,
      median_ulp: 1,
      p99_ulp: 3,
      ulp_ceiling: 1024,
      ceiling_exceeded: false,
      domain: [
        { name: 'n', kind: 'int', lo: 0, hi: 10 },
        { name: 'x', kind: 'float', lo: 1e-3, hi: 500 }
      ],
      worst_case: { args: [2, 458.6], mpmath_ref: 0.123, ranjs_value: 0.1230001 }
    },
    // Multi-arg domain with a non-trivial name/value pairing (nu before x) so an
    // index-pairing regression in fmtArgs would produce a reproducer that swaps them.
    besselInu: {
      n: 10000,
      errors: 0,
      divergences: 0,
      max_ulp: 5000,
      median_ulp: 2,
      p99_ulp: 4000,
      ulp_ceiling: 1024,
      ceiling_exceeded: true,
      domain: [
        { name: 'nu', kind: 'float', lo: -5, hi: 5 },
        { name: 'x', kind: 'float', lo: 1e-3, hi: 700 }
      ],
      worst_case: { args: [0.498, 686.2], mpmath_ref: 12345678900, ranjs_value: 12345699000 }
    },
    // ceiling_exceeded: false with divergences > 0 -- the #1369 regression case: a finite
    // max_ulp (inf is excluded from the ceiling comparison by design) must still surface
    // as an offender, not stay masked because the ceiling check alone says "fine".
    gammaLower: {
      n: 10000,
      errors: 0,
      divergences: 2,
      max_ulp: 12,
      median_ulp: 1,
      p99_ulp: 10,
      ulp_ceiling: 1024,
      ceiling_exceeded: false,
      domain: [{ name: 'x', kind: 'float', lo: 1e-3, hi: 100 }],
      worst_case: { args: [42.1], mpmath_ref: NaN, ranjs_value: 0.5 }
    }
  }
}

// Shaped exactly like scripts/difftest-dist.py's build_report() output (entries keyed by
// 'Dist.method', domain.params a positional list of {name, ...} specs, worst_case.params
// positional plus worst_case.x).
const DIST_REPORT = {
  seed: 1234,
  mpmath_version: '1.3.0',
  mp_dps: 50,
  entries: {
    // Divergence-only entry with ceiling_exceeded: false -- the dist-source counterpart to
    // gammaLower above, exercising the same #1369 "a finite max_ulp must still surface as
    // an offender even when the ceiling check alone says fine" path. Not allowlisted:
    // Gamma.pdf's own KNOWN_ISSUES entry (#1363) was removed once the underlying issue
    // closed (besselK/besselKnu's #1140 entry was removed at the same time), so this
    // doubles as a non-allowlisted example too -- knownIssue must resolve to null here,
    // same as the other non-allowlisted entries below (Weibull.cdf, F.pdf, Beta.pdf,
    // Normal.pdf).
    'Gamma.pdf': {
      n: 10000,
      errors: 0,
      divergences: 4,
      max_ulp: 10,
      median_ulp: 1,
      p99_ulp: 8,
      ulp_ceiling: 4096,
      ceiling_exceeded: false,
      domain: {
        params: [{ name: 'alpha', lo: 0.01, hi: 100 }, { name: 'beta', lo: 0.01, hi: 100 }],
        x_via_quantile_of_p: [0.001, 0.999]
      },
      worst_case: { dist: 'Gamma', params: [1.2, 3.4], x: 5.6, mpmath_ref: 0.001, ranjs_value: NaN }
    },
    // Multi-param domain with a non-trivial name/value pairing (d1 before d2) so an
    // index-pairing regression in fmtArgs would produce a reproducer that swaps them.
    'F.pdf': {
      n: 10000,
      errors: 0,
      divergences: 0,
      max_ulp: 2000000,
      median_ulp: 100,
      p99_ulp: 900000,
      ulp_ceiling: 1500000,
      ceiling_exceeded: true,
      domain: {
        params: [{ name: 'd1', lo: 1, hi: 200 }, { name: 'd2', lo: 1, hi: 200 }],
        x_via_quantile_of_p: [0.001, 0.999]
      },
      worst_case: { dist: 'F', params: [10, 1], x: 522179.3, mpmath_ref: 1e-10, ranjs_value: 1.1e-10 }
    },
    // Unknown (not in the allowlist) eval-error entry -- errors > 0 with ceiling_exceeded:
    // false and divergences: 0 must still fail the gate, distinctly from a divergence.
    'Weibull.cdf': {
      n: 10000,
      errors: 3,
      divergences: 0,
      max_ulp: 5,
      median_ulp: 1,
      p99_ulp: 4,
      ulp_ceiling: 1024,
      ceiling_exceeded: false,
      domain: {
        params: [{ name: 'lambda', lo: 0.01, hi: 100 }, { name: 'k', lo: 0.01, hi: 100 }],
        x_via_quantile_of_p: [0.001, 0.999]
      },
      worst_case: { dist: 'Weibull', params: [1.5, 2.5], x: 3.1, mpmath_ref: 0.2, ranjs_value: 0.2 }
    },
    // Two simultaneous failure reasons on the same key (errors > 0 AND divergences > 0) --
    // regression fixture for offenderReasons() composing every applicable reason instead
    // of an if/else-if chain that would drop the second one silently.
    'Beta.pdf': {
      n: 10000,
      errors: 2,
      divergences: 3,
      max_ulp: 7,
      median_ulp: 1,
      p99_ulp: 6,
      ulp_ceiling: 1024,
      ceiling_exceeded: false,
      domain: {
        params: [{ name: 'alpha', lo: 0.01, hi: 100 }, { name: 'beta', lo: 0.01, hi: 100 }],
        x_via_quantile_of_p: [0.001, 0.999]
      },
      worst_case: { dist: 'Beta', params: [2.1, 3.7], x: 0.4, mpmath_ref: NaN, ranjs_value: NaN }
    },
    // Fully clean entry (no ceiling breach, no divergence, no error) for the "not an
    // offender at all" cases -- Gamma.pdf above doesn't serve that role since it carries
    // a divergence.
    'Normal.pdf': {
      n: 10000,
      errors: 0,
      divergences: 0,
      max_ulp: 3,
      median_ulp: 1,
      p99_ulp: 2,
      ulp_ceiling: 1024,
      ceiling_exceeded: false,
      domain: {
        params: [{ name: 'mu', lo: -10, hi: 10 }, { name: 'sigma', lo: 0.01, hi: 10 }],
        x_via_quantile_of_p: [0.001, 0.999]
      },
      worst_case: { dist: 'Normal', params: [0, 1], x: 0.5, mpmath_ref: 0.352, ranjs_value: 0.3521 }
    }
  }
}

// Regression fixtures for #1372's per-reason allowlist suppression -- hand-built offender
// records (the shape collectOffenders() produces internally), constructed directly rather
// than routed through distOffenders()/production KNOWN_ISSUES. isGateFailure() and
// renderSummary() only ever read an offender's own reasonKeys/allowlistedReasonKeys/
// knownIssue fields and never consult KNOWN_ISSUES themselves, so this is the correct
// level to exercise the suppression logic at -- independent of whatever production's
// KNOWN_ISSUES map currently contains (currently empty: every previously-tracked entry's
// underlying issue has closed). Gamma.pdf's own entry was removed once #1363 closed;
// reusing its shape here as a synthetic "as if allowlisted" example keeps this regression
// test working without depending on any real tracked entry existing.
const ALLOWLISTED_DIVERGENCE_OFFENDER = {
  source: 'dist',
  entry: 'Gamma.pdf',
  maxUlp: 10,
  ceiling: 4096,
  reasons: ['❌ 4 divergence(s) (NaN/Infinity vs. finite mpmath reference)'],
  reasonKeys: ['divergences'],
  allowlistedReasonKeys: ['divergences'],
  knownIssue: 1363,
  reproducer: 'alpha=1.2, beta=3.4, x=5.6 → ranjs=NaN, mpmath=0.001'
}

// Same key, but with a brand-new eval-error reason on top of the allowlisted divergence --
// must still fail the gate even though the key is partially allowlisted (#1372).
const PARTIALLY_ALLOWLISTED_OFFENDER = {
  ...ALLOWLISTED_DIVERGENCE_OFFENDER,
  reasons: ['💥 3 eval error(s)', ...ALLOWLISTED_DIVERGENCE_OFFENDER.reasons],
  reasonKeys: ['errors', 'divergences']
}

// Shared by the specialOffenders()/distOffenders() "correct fields" tests below -- both
// exercise the same offender-record shape through different producer functions, and
// CodeScene flagged the un-factored pair as duplication (PR #1373 review).
function assertOffenderFields (offender, expected) {
  assert.strictEqual(offender.source, expected.source)
  assert.strictEqual(offender.entry, expected.entry)
  assert.strictEqual(offender.maxUlp, expected.maxUlp)
  assert.strictEqual(offender.ceiling, expected.ceiling)
  assert.isNull(offender.knownIssue)
}

describe('scripts/difftest-ci-gate', () => {
  describe('.fmtArgs()', () => {
    it('should pair each spec name with its value by index, not by name lookup', () => {
      const specs = [{ name: 'nu' }, { name: 'x' }]
      assert.strictEqual(fmtArgs(specs, [0.498, 686.2]), 'nu=0.498, x=686.2')
    })
  })

  describe('.specialOffenders()', () => {
    it('should return no offenders for a fully clean entry', () => {
      const offenders = specialOffenders({ functions: { besselJ: SPECIAL_REPORT.functions.besselJ } })
      assert.strictEqual(offenders.length, 0)
    })

    it('should collect the correct fields for an entry with ceiling_exceeded: true', () => {
      const offenders = specialOffenders({ functions: { besselInu: SPECIAL_REPORT.functions.besselInu } })
      assert.strictEqual(offenders.length, 1)
      assertOffenderFields(offenders[0], { source: 'special', entry: 'besselInu', maxUlp: 5000, ceiling: 1024 })
    })

    it('should collect an entry with divergences > 0 and ceiling_exceeded: false', () => {
      const offenders = specialOffenders({ functions: { gammaLower: SPECIAL_REPORT.functions.gammaLower } })
      assert.strictEqual(offenders.length, 1)
      assert.match(offenders[0].reasons.join(';'), /2 divergence/)
    })

    it('should pair multi-arg reproducer names with their values by name, in order', () => {
      const offenders = specialOffenders({ functions: { besselInu: SPECIAL_REPORT.functions.besselInu } })
      const reproducer = offenders[0].reproducer
      // A swapped-index regression would emit "nu=686.2, x=0.498" instead.
      assert.include(reproducer, 'nu=0.498, x=686.2')
      assert.isBelow(reproducer.indexOf('nu=0.498'), reproducer.indexOf('x=686.2'))
      assert.include(reproducer, 'ranjs=12345699000')
      assert.include(reproducer, 'mpmath=12345678900')
    })
  })

  describe('.distOffenders()', () => {
    it('should return no offenders for a fully clean entry', () => {
      const offenders = distOffenders({ entries: { 'Normal.pdf': DIST_REPORT.entries['Normal.pdf'] } })
      assert.strictEqual(offenders.length, 0)
    })

    it('should collect the correct fields for an entry with ceiling_exceeded: true', () => {
      const offenders = distOffenders({ entries: { 'F.pdf': DIST_REPORT.entries['F.pdf'] } })
      assert.strictEqual(offenders.length, 1)
      assertOffenderFields(offenders[0], { source: 'dist', entry: 'F.pdf', maxUlp: 2000000, ceiling: 1500000 })
    })

    it('should collect an entry with errors > 0 and ceiling_exceeded: false, divergences: 0', () => {
      const offenders = distOffenders({ entries: { 'Weibull.cdf': DIST_REPORT.entries['Weibull.cdf'] } })
      assert.strictEqual(offenders.length, 1)
      assert.match(offenders[0].reasons.join(';'), /3 eval error/)
      assert.isNull(offenders[0].knownIssue)
    })

    it('should collect a divergence entry with no known-issue allowlist match', () => {
      // Gamma.pdf's own KNOWN_ISSUES entry was removed (#1363 closed), so a real
      // divergence source still resolves knownIssue to null -- the dist-source
      // counterpart to the special-source gammaLower case above.
      const offenders = distOffenders({ entries: { 'Gamma.pdf': DIST_REPORT.entries['Gamma.pdf'] } })
      assert.strictEqual(offenders.length, 1)
      assert.match(offenders[0].reasons.join(';'), /4 divergence/)
      assert.isNull(offenders[0].knownIssue)
    })

    it('should compose both reasons for an entry with errors > 0 and divergences > 0 at once', () => {
      const offenders = distOffenders({ entries: { 'Beta.pdf': DIST_REPORT.entries['Beta.pdf'] } })
      assert.strictEqual(offenders.length, 1)
      // A regression to a first-match-wins if/else-if chain would drop one of these.
      assert.strictEqual(offenders[0].reasons.length, 2)
      const joined = offenders[0].reasons.join(';')
      assert.match(joined, /eval error/)
      assert.match(joined, /divergence/)
    })

    it('should pair multi-param reproducer names with their values by name, in order, plus x', () => {
      const offenders = distOffenders({ entries: { 'F.pdf': DIST_REPORT.entries['F.pdf'] } })
      const reproducer = offenders[0].reproducer
      // A swapped-index regression would emit "d1=1, d2=10" instead.
      assert.include(reproducer, 'd1=10, d2=1, x=522179.3')
      assert.isBelow(reproducer.indexOf('d1=10'), reproducer.indexOf('d2=1'))
      assert.isBelow(reproducer.indexOf('d2=1'), reproducer.indexOf('x=522179.3'))
    })
  })

  describe('.collectOffenders()', () => {
    // Production KNOWN_ISSUES is currently {} (every previously-tracked entry's underlying
    // issue has closed), so specialOffenders()/distOffenders() never drive the
    // `knownIssues[key] || null` lookup and allowlist.reasons/allowlist.issue extraction
    // through their truthy branch -- a regression there (e.g. reading `.reasonKeys`
    // instead of `.reasons`) would go undetected until a real KNOWN_ISSUES entry exists
    // again. Calling collectOffenders() directly with a synthetic, non-empty knownIssues
    // map keeps that lookup covered independent of what production's map currently holds.
    it('should populate allowlistedReasonKeys and knownIssue from a matching knownIssues entry', () => {
      const knownIssues = { 'Gamma.pdf': { issue: 1234, reasons: ['divergences'] } }
      const [offender] = collectOffenders(
        { 'Gamma.pdf': DIST_REPORT.entries['Gamma.pdf'] },
        'dist',
        data => `${fmtArgs(data.domain.params, data.worst_case.params)}, x=${data.worst_case.x}`,
        knownIssues
      )
      assert.strictEqual(offender.knownIssue, 1234)
      assert.deepEqual(offender.allowlistedReasonKeys, ['divergences'])
    })

    it('should resolve allowlistedReasonKeys to [] and knownIssue to null when the key has no knownIssues entry', () => {
      const [offender] = collectOffenders(
        { 'Gamma.pdf': DIST_REPORT.entries['Gamma.pdf'] },
        'dist',
        data => `${fmtArgs(data.domain.params, data.worst_case.params)}, x=${data.worst_case.x}`,
        { 'SomeOther.pdf': { issue: 9999, reasons: ['divergences'] } }
      )
      assert.isNull(offender.knownIssue)
      assert.deepEqual(offender.allowlistedReasonKeys, [])
    })
  })

  describe('.isGateFailure()', () => {
    it('should treat an unknown offender as a gate failure', () => {
      const [offender] = distOffenders({ entries: { 'F.pdf': DIST_REPORT.entries['F.pdf'] } })
      assert.isTrue(isGateFailure(offender))
    })

    it('should not treat a fully allowlisted offender as a gate failure', () => {
      assert.isFalse(isGateFailure(ALLOWLISTED_DIVERGENCE_OFFENDER))
    })

    it('should treat an allowlisted entry as a gate failure once it develops a new, non-allowlisted reason', () => {
      // The divergence reason stays allowlisted (#1363); the new eval-error reason is not,
      // so the entry as a whole must still fail the gate (#1372).
      assert.isTrue(isGateFailure(PARTIALLY_ALLOWLISTED_OFFENDER))
      assert.strictEqual(PARTIALLY_ALLOWLISTED_OFFENDER.knownIssue, 1363)
      assert.match(PARTIALLY_ALLOWLISTED_OFFENDER.reasons.join(';'), /divergence/)
      assert.match(PARTIALLY_ALLOWLISTED_OFFENDER.reasons.join(';'), /eval error/)
    })
  })

  describe('.renderSummary()', () => {
    it('should report a passing status when there are no offenders', () => {
      const summary = renderSummary([])
      assert.include(summary, 'All entries within their declared ULP ceiling, with no new divergences or eval errors.')
      assert.notInclude(summary, '❌')
    })

    it('should report a failing status counting only non-allowlisted offenders', () => {
      const offenders = [...specialOffenders(SPECIAL_REPORT), ...distOffenders(DIST_REPORT)]
      const summary = renderSummary(offenders)
      // besselInu, gammaLower, F.pdf, Weibull.cdf, Beta.pdf, and Gamma.pdf all fail the
      // gate -- production KNOWN_ISSUES is empty (every previously-tracked entry's
      // underlying issue has closed), so nothing in these fixtures is allowlisted.
      assert.include(summary, '❌ 6 entries')
      assert.include(summary, '`besselInu`')
      assert.include(summary, '`gammaLower`')
      assert.include(summary, '`F.pdf`')
      assert.include(summary, '`Weibull.cdf`')
      assert.include(summary, '`Beta.pdf`')
      assert.include(summary, '`Gamma.pdf`')
    })

    it('should list an allowlisted known-issue offender in the table, marked as such', () => {
      // Uses the hand-built fixture rather than a real allowlisted entry, since
      // production KNOWN_ISSUES no longer carries a Gamma.pdf entry to route through
      // distOffenders() -- this exercises renderSummary()'s annotation rendering
      // directly against an offender record shaped as if it were allowlisted.
      const summary = renderSummary([ALLOWLISTED_DIVERGENCE_OFFENDER])
      assert.include(summary, '`Gamma.pdf`')
      assert.include(summary, '#1363')
      assert.match(summary, /allowlisted/i)
    })

    it('should distinguish a divergence/error reason from a plain ceiling breach in the table', () => {
      const offenders = [...specialOffenders(SPECIAL_REPORT), ...distOffenders(DIST_REPORT)]
      const summary = renderSummary(offenders)
      const besselInuRow = summary.split('\n').find(line => line.includes('`besselInu`'))
      const gammaLowerRow = summary.split('\n').find(line => line.includes('`gammaLower`'))
      assert.match(besselInuRow, /ceiling exceeded/i)
      assert.match(gammaLowerRow, /divergence/i)
    })

    it('should mark only the allowlisted reason, not the whole row, for a mixed known/new-failure entry', () => {
      const summary = renderSummary([PARTIALLY_ALLOWLISTED_OFFENDER])
      const row = summary.split('\n').find(line => line.includes('`Gamma.pdf`'))
      // Reason cell is the 5th `|`-delimited column; split into its individual `; `
      // reasons so each one's annotation is checked independently, instead of a single
      // regex over the whole row where a later reason's "allowlisted" text could
      // false-positive-match an earlier, unrelated reason.
      const reasonCell = row.split('|')[5]
      const [errorReason, divergenceReason] = reasonCell.split(';').map(s => s.trim())
      assert.match(errorReason, /eval error/i)
      assert.notMatch(errorReason, /allowlisted/i)
      assert.match(divergenceReason, /divergence/i)
      assert.match(divergenceReason, /allowlisted.*#1363/i)
      // The row still counts toward the gate-failure total since the entry as a whole
      // did not stay fully suppressed.
      assert.include(summary, '❌ 1 entry')
    })
  })
})
