const { assert } = require('chai')
const { describe, it } = require('mocha')
const { specialOffenders, distOffenders, renderSummary, fmtArgs } = require('../../scripts/difftest-ci-gate')

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
    'Gamma.pdf': {
      n: 10000,
      errors: 0,
      divergences: 0,
      max_ulp: 10,
      median_ulp: 1,
      p99_ulp: 8,
      ulp_ceiling: 4096,
      ceiling_exceeded: false,
      domain: {
        params: [{ name: 'alpha', lo: 0.01, hi: 100 }, { name: 'beta', lo: 0.01, hi: 100 }],
        x_via_quantile_of_p: [0.001, 0.999]
      },
      worst_case: { dist: 'Gamma', params: [1.2, 3.4], x: 5.6, mpmath_ref: 0.001, ranjs_value: 0.0011 }
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
    }
  }
}

describe('scripts/difftest-ci-gate', () => {
  describe('.fmtArgs()', () => {
    it('should pair each spec name with its value by index, not by name lookup', () => {
      const specs = [{ name: 'nu' }, { name: 'x' }]
      assert.strictEqual(fmtArgs(specs, [0.498, 686.2]), 'nu=0.498, x=686.2')
    })
  })

  describe('.specialOffenders()', () => {
    it('should return no offenders for an entry with ceiling_exceeded: false', () => {
      const offenders = specialOffenders({ functions: { besselJ: SPECIAL_REPORT.functions.besselJ } })
      assert.strictEqual(offenders.length, 0)
    })

    it('should collect the correct fields for an entry with ceiling_exceeded: true', () => {
      const offenders = specialOffenders(SPECIAL_REPORT)
      assert.strictEqual(offenders.length, 1)
      const offender = offenders[0]
      assert.strictEqual(offender.source, 'special')
      assert.strictEqual(offender.entry, 'besselInu')
      assert.strictEqual(offender.maxUlp, 5000)
      assert.strictEqual(offender.ceiling, 1024)
    })

    it('should pair multi-arg reproducer names with their values by name, in order', () => {
      const offenders = specialOffenders(SPECIAL_REPORT)
      const reproducer = offenders[0].reproducer
      // A swapped-index regression would emit "nu=686.2, x=0.498" instead.
      assert.include(reproducer, 'nu=0.498, x=686.2')
      assert.isBelow(reproducer.indexOf('nu=0.498'), reproducer.indexOf('x=686.2'))
      assert.include(reproducer, 'ranjs=12345699000')
      assert.include(reproducer, 'mpmath=12345678900')
    })
  })

  describe('.distOffenders()', () => {
    it('should return no offenders for an entry with ceiling_exceeded: false', () => {
      const offenders = distOffenders({ entries: { 'Gamma.pdf': DIST_REPORT.entries['Gamma.pdf'] } })
      assert.strictEqual(offenders.length, 0)
    })

    it('should collect the correct fields for an entry with ceiling_exceeded: true', () => {
      const offenders = distOffenders(DIST_REPORT)
      assert.strictEqual(offenders.length, 1)
      const offender = offenders[0]
      assert.strictEqual(offender.source, 'dist')
      assert.strictEqual(offender.entry, 'F.pdf')
      assert.strictEqual(offender.maxUlp, 2000000)
      assert.strictEqual(offender.ceiling, 1500000)
    })

    it('should pair multi-param reproducer names with their values by name, in order, plus x', () => {
      const offenders = distOffenders(DIST_REPORT)
      const reproducer = offenders[0].reproducer
      // A swapped-index regression would emit "d1=1, d2=10" instead.
      assert.include(reproducer, 'd1=10, d2=1, x=522179.3')
      assert.isBelow(reproducer.indexOf('d1=10'), reproducer.indexOf('d2=1'))
      assert.isBelow(reproducer.indexOf('d2=1'), reproducer.indexOf('x=522179.3'))
    })
  })

  describe('.renderSummary()', () => {
    it('should report a passing status when there are no offenders', () => {
      const summary = renderSummary([])
      assert.include(summary, '✅ All entries within their declared ULP ceiling.')
      assert.notInclude(summary, '❌')
    })

    it('should report a failing status naming the offender count and reproducer table', () => {
      const offenders = [...specialOffenders(SPECIAL_REPORT), ...distOffenders(DIST_REPORT)]
      const summary = renderSummary(offenders)
      assert.include(summary, '❌ 2 entries exceeded their declared ULP ceiling.')
      assert.include(summary, '`besselInu`')
      assert.include(summary, '`F.pdf`')
    })
  })
})
