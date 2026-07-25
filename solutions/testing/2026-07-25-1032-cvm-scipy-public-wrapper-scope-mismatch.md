---
date: 2026-07-25T10:32:01Z
category: "testing"
problem: "scipy's public cramervonmises() p-value didn't match a correct, deliberately-scoped ranjs implementation because the public wrapper silently applies a finite-sample correction the issue scoped out"
status: complete
related_issue: "#1134"
related_plan: "thoughts/plans/2026-07-25-0946-cramer-von-mises-test.md"
tags: [testing, external-reference, scipy, cramer-von-mises, asymptotic-approximation, reference-sourcing]
---

# Solution: scipy's public API scope didn't match ranjs's deliberately-scoped implementation

**Date**: 2026-07-25T10:32:01Z
**Category**: testing
**Related Issue**: #1134

## Problem

While writing `closeTo` reference-value tests for the new `ran.test.cramerVonMises` (per CLAUDE.md's
"reference values must be externally sourced" rule), the obvious reference call —
`scipy.stats.cramervonmises(values, 'norm', args=(0,1)).pvalue` — did not match ranjs's output, even
though the implementation correctly followed the cited paper (Csörgő & Faraway 1996) for the scope
issue #1134 defined.

## Root Cause

scipy's *public* `cramervonmises()` wrapper doesn't only evaluate the asymptotic (`n → ∞`) series
— it also applies a finite-sample correction term (`_psi1_mod(x, n) / n`, Csörgő & Faraway eq. 1.8)
on top of the pure asymptotic CDF (`_cdf_cvm_inf`, eq. 1.2/1.3). Issue #1134 explicitly excluded
that refinement ("advanced asymptotic theory beyond standard approximations" is out of scope), so
the ranjs implementation only ports the pure asymptotic series. That makes the public wrapper's
`.pvalue` and the ranjs implementation two different — each internally correct — computations for
two different mathematical scopes. Using the wrapper's output as a reference would fail regardless
of implementation correctness, because it compares against a *different formula*, not a bug.

## Fix

Reference `pValue` values were sourced by calling scipy's internal
`scipy.stats._hypotests._cdf_cvm_inf(stat)` directly (`pValue_ref = 1 - _cdf_cvm_inf(stat)`) — the
exact piece scipy uses internally, matching the implementation's declared scope. `stat` reference
values could still safely use the public wrapper's `.statistic`, since that sub-computation is
identical either way (the eq. 1.8 correction only touches the CDF/p-value step, not the statistic
itself). Both call sites are cited inline in `test/test.js` with an explanatory comment noting why
the public API's `.pvalue` isn't the reference used.

## Prevention Strategy

When an implementation deliberately scopes to a documented subset of a published algorithm (per an
issue's explicit "out of scope" carve-out), never assume a reference library's top-level public API
matches that same scope. Before writing `closeTo` reference values, read the reference library's
*source* (not just its docs/docstring) to find which internal function corresponds exactly to the
scoped formula being ported, and use that function's output as the reference — not the public
wrapper's, which may silently bundle extra corrections. Document in the test comment which specific
internal function was called and why, so a future reader isn't confused by the discrepancy from the
"obvious" public API call.

## Related Solutions

- `solutions/testing/2026-07-18-1641-ess-geyer-ipsm-pairing-offset-self-consistent-wrong-tests.md`
  — a different failure mode in the same family (external-verification pitfalls): there, a
  hand-derived reference value encoded the same wrong understanding as the implementation, so a
  green suite hid a real bug. Here, the implementation was already correct and the reference source
  itself needed to be pointed at the right internal function — the fix is at the opposite end (test
  authoring), but both cases share the lesson that reference-value provenance needs the same
  scrutiny as the implementation it's meant to check.

## Key Insight

When a reference library's public API layers a correction on top of an asymptotic core that an
implementation deliberately scoped out, `closeTo` tests must be sourced from that library's internal
function matching the exact scoped subset — otherwise the tests can never pass regardless of
implementation correctness, and the failure looks like a bug when it's really a reference-value
mismatch.
