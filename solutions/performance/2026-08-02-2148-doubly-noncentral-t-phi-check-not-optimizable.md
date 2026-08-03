---
date: 2026-08-02T21:48:06Z
category: "performance"
problem: "Can DoublyNoncentralT's phi-equality check be gated behind a cheap pre-filter to claw back test/guess.js's post-#1298 runtime?"
status: complete
related_issue: "1317"
related_plan: "thoughts/plans/2026-08-02-2115-guess-fit-all-runtime-not-optimizable-1317.md"
tags: [doubly-noncentral-t, noncentral-t, fit, guess, performance-investigation, fallback-gate-design, firing-rate-instrumentation]
---

# Solution: `DoublyNoncentralT`'s `phi`-equality check cannot be pre-filtered without reopening #1298

**Date**: 2026-08-02T21:48:06Z
**Category**: performance
**Related Issue**: #1317

## Problem

Issue #1317 asked whether `DoublyNoncentralT._fnmDiff`/`_cdfTerm`'s `phi`-equality check (added by
#1298 to catch a cancellation blind spot) could be gated behind a cheap `nu`-magnitude pre-filter —
mirroring the existing `nu0 >= 30` magnitude-check gate from #1250 — to claw back the runtime it
added to `test/guess.js`'s fit-all-distributions test, which roughly doubled (~23-24s to ~48-52s)
once the check landed.

## Root Cause

Not a code defect — a mismatch between the intuition documented in `_fnmDiff`'s own JSDoc (written
during #1298) and the check's actual firing distribution. That JSDoc asserted the check "only fires
when [the correction] is genuinely unresolved, which requires y = x^2/(nu+x^2) small enough... not
the O(1)-scale case `.fit()`'s optimizer exploration evaluates against sampled data" — i.e. it
assumed `.fit()` rarely lands in the small-`y`/phi-stuck regime.

Direct instrumentation of the exact `test/guess.js` "default candidate pool" call
(`guess(new Normal(5, 2).seed(42).sample(500))`) found the opposite: the `phi`-check fires in 65% of
all `_fnmDiff` calls (9220 of 14187), and of the fires the existing magnitude check does not also
catch (7993 calls), 99.96% (7990) change the returned difference by more than `1e-12` relative to
the raw value — one measured case swings ~14x (`5.31e-5 → 3.82e-6` at `hi.nu=14, lo.nu=12,
x≈0.04-0.045, mu≈-3.38`). These firings are also concentrated almost entirely (99.98%, 7991 of 7993)
at `nu0 < 30` — exactly the regime `.fit()`'s optimizer explores most (`_fitInit` seeds `nu` as low
as 3) and exactly the regime #1298's own reported failure case (`DoublyNoncentralT(5, 5, 120)`,
`nu=5`) sits in.

This means the "expensive" firings are not defensive/spurious overhead a pre-filter could safely
skip — they are the correctness fix itself, concentrated precisely where any `nu`-magnitude gate
would need to exclude cases to have any effect on the firing rate. A gate loose enough to leave the
necessary corrections alone (`nu0 >= 30`, matching the existing magnitude check) does nothing to the
firing rate, since 99.98% of firings are already below that threshold; a gate tight enough to reduce
the firing rate would exclude cases proven necessary, silently reopening #1298 for `nu < 30`.

## Fix

No change to the gating logic. A design-propose/design-critique agent pair evaluated two candidate
code changes and rejected both:

- **Caching `snm(hi)` across consecutive `_pdfPoissonMixture` terms.** Mathematically valid —
  verified by direct iteration trace that term `i`'s `hi` argument is bit-identical to term `i+1`'s
  `lo` argument (both reduce to `Math.sqrt(1 + 2i/nu)` via exact integer arithmetic on the same
  `nu`) — so a cached `snm` result could legitimately be reused. Rejected anyway: the estimated
  savings (~35-45% of `snm` calls) would land `test/guess.js` around 35-42s, still short of the
  issue's own `<32s` target, while adding stateful cross-iteration caching to `_fnmDiff` — a private
  method already restructured once during #1250 after a CodeScene arg-count flag — and coupling
  `recursiveSum`'s generic state-object contract to one distribution's fallback-gate internals.
- **Hoisting the loop-invariant `phi = 0.5*(1+erf(-mu/√2))` out of the per-term loop.** Also
  mathematically safe (`mu` is constant across all `recursiveSum` iterations within one `_pdf`/`_cdf`
  call) but the savings are under 500ms (~1% of the test's runtime, since `erf` is cheap relative to
  `snm`'s tanh-sinh quadrature), and threading `phi` through `_cdfTerm`'s signature would push it to
  5 parameters — the exact CodeScene "Excess Number of Function Arguments" threshold `_fnmDiff` was
  already reworked around once during #1250 (from 5 scalar args down to 3).

The only change shipped is a ~20-line JSDoc addition to `_fnmDiff`/`_cdfTerm` in
`src/dist/doubly-noncentral-t.js` documenting the measured firing rates and why no pre-filter is
safe, correcting the stale "not the O(1)-scale case" assumption in the original #1298-era comment.
The issue closes as not-planned via the shipped PR.

## Prevention Strategy

**Before proposing a "cheap pre-filter" for an expensive correctness check, instrument its actual
firing distribution against the real workload — not a synthetic benchmark or an intuition about
where the check "should" be needed.** Measure what fraction of firings are load-bearing (change the
result meaningfully) versus defensive/negligible, and where they concentrate parametrically. A
pre-filter is viable only if it can be shown to exclude a region dominated by defensive firings; if
the region a filter would need to exclude is the same region dominated by load-bearing corrections,
the "optimization" is a correctness regression by construction, not a performance trade-off — no
amount of clever gating changes that.

This generalizes the union-not-replacement discipline already established by #1250/#1298: any
narrowing of a numerical trustworthiness gate — whether removing a check outright (tried and
reverted during #1298) or adding a new exclusion condition to an existing check (this issue's
proposal) — must be validated against measured firing data across the real workload, not just
plausible-sounding reasoning about when the underlying phenomenon "should" occur. A comment's own
stated assumption about a check's firing regime (here, `_fnmDiff`'s pre-#1317 JSDoc) is not a
substitute for measuring it, and can go stale the moment a downstream caller's usage pattern
(`.fit()`'s optimizer exploring low-`nu` parameter space) differs from what the comment's author
pictured when the check was first added.

**When a proposed optimization is evaluated and rejected, size the rejection honestly against the
issue's own numeric target**, not just "is this better than nothing." The `snm`-caching option was
real and mathematically sound but was rejected specifically because 35-42s still misses the `<32s`
goal — a partial win that adds material complexity to an already-fragile file is a worse trade than
no change at all when it doesn't clear the bar the issue itself set.

## Related Solutions

- `solutions/correctness/2026-08-01-2030-noncentral-t-fnm-snm-boundary-saturation.md` (#1250) —
  introduced `NoncentralT.snm` and the `nu0 >= 30` magnitude gate this issue investigated
  pre-filtering further; its own "Prevention Strategy" already warned that this threshold was
  empirically tuned against `.fit()`'s exploration regime, not a general-purpose speed valve.
- `solutions/correctness/2026-08-02-2100-noncentral-t-fnm-dual-saturation-mechanism.md` (#1298) —
  introduced the `phi`-equality check itself, after a reverted attempt to *replace* (not union with)
  the magnitude gate regressed the precision suite. This investigation reconfirms that precedent
  from the performance side: narrowing this exact gate, in either direction, keeps failing for the
  same underlying reason — the two failure modes it guards against are not nested, and neither
  check's firing region is a superset of the other's necessary cases.
- `solutions/performance/2026-07-22-0702-doubly-noncentral-fit-powell-ridge-cost.md` (#1063) — a
  sibling distribution family's performance investigation that also found a confident initial
  diagnosis needed real instrumentation to overturn; the same "profile the actual repro, don't trust
  a plausible-sounding hypothesis" discipline applies here, on the correctness-vs-performance
  trade-off side rather than the root-cause-identification side.

## Key Insight

When a correctness-fix's expensive gate correlates almost perfectly with the exact parameter regime
a proposed speed-up would need to exclude, the gate cannot be cheapened without reopening the bug it
was written to fix — verify this via firing-rate and correction-magnitude instrumentation against
the real workload before proposing, let alone implementing, any pre-filter, rather than assuming a
cheap proxy exists because a similar-looking gate elsewhere in the same file has one.
