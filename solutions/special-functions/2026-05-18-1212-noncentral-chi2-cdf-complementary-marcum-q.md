---
date: 2026-05-18T12:12:00Z
category: "special-functions"
problem: "NoncentralChi2._cdf returned 0 in the lower tail due to a hidden subtraction-from-1 inside marcumQ stacked with a second subtraction at the call site"
status: complete
related_issue: "#245"
related_plan: "thoughts/plans/2026-05-18-1200-issue-245-noncentral-chi2-marcum-q-complement.md"
tags: [catastrophic-cancellation, marcum-q, noncentral-chi2, complementary-form, refvals, sub-precision, paired-exports, hidden-subtraction]
---

# Solution: NoncentralChi2._cdf complementary Marcum Q form

**Date**: 2026-05-18T12:12:00Z
**Category**: special-functions
**Related Issue**: #245

## Problem

`NoncentralChi2._cdf(x)` returned `0` or `~1.11e-16` (≈ `ulp(1)` garbage)
instead of the correct sub-precision value for small `x`. With the
distribution's own test parameters `(k=11, lambda=2)`:

- `cdf(1e-2)` returned ≈ `1.11e-16` instead of the correct `≈ 2.81e-16`.
- `cdf(1e-4)` returned exactly `0` instead of the correct `≈ 2.82e-27`.

The CDF was entirely non-functional in the distribution's lower tail.
Pre-existing refVals stopped at `x=0.5`, where the CDF is already
`~5e-7` — well above the cancellation regime — so the bug was invisible
to the test suite.

## Root Cause

**Two stacked subtractions from 1, with the first one hidden inside a
special function.** Unlike the prior `1 - F(...)` cancellation bugs in
this codebase (#214, #243, #244), here the **first** of the two
subtractions did not appear at the call site — it lived inside
`marcumQ`.

`marcumQ(mu, x, y)` uses a two-branch series implementation in
`src/special/marcum-q.js`. It picks `primary = y > x + mu ? 'q' : 'p'`.
When `y ≤ x + mu` (the regime where Q ≈ 1 and the complement is tiny),
the `p`-branch computes the **complement directly** as
`P = exp(-x) · Σ (x^k/k!) · γ(mu+k, y)/Γ(mu+k)` — and then formed
`return 1 - exp(-x) * z` to deliver `Q`. The information in `P` was
intentionally discarded by the subtraction, on the assumption that the
caller wanted `Q`.

`NoncentralChi2._cdf` then formed `1 - marcumQ(...)` to convert the
survival to the CDF. The actual evaluation chain was:

```
exp(-x) * z          → tiny but exact     (CDF value, sub-ulp(1))
1 - exp(-x) * z      → 1.0 to ulp(1)      (first cancellation, inside marcumQ)
1 - (1 - exp(-x)*z)  → 0 or ulp(1) garbage (second cancellation, in _cdf)
```

The cancellation was invisible at the distribution layer because the
first subtraction had already completed inside `marcumQ` before
`_cdf` saw its return value. From `_cdf`'s perspective, the input was
just "a number very close to 1" — its only sin was applying a single
`1 - ...`, which seems harmless until you realize what was thrown away.

The `refValTol` relative-tolerance fallback added in #243 was already
in place for sub-precision expected values, so adding boundary refVals
alone was sufficient to surface the bug — no further test-framework
change was needed.

## Fix

Three coordinated changes — production-side only (no test-framework
change required this time).

**1. Helper extraction** (`src/special/marcum-q.js`):
Extracted the body of `_seriesExpansion.p` (everything except the final
`1 - ...` step) into a private `_pSeriesComplement(mu, x, y)` returning
`exp(-x) * z` directly. The existing `_seriesExpansion.p` was reduced
to `return 1 - _pSeriesComplement(mu, x, y)`. This preserves
bitwise-identical `marcumQ` behavior — the arithmetic chain is
unchanged, just routed through a named helper.

**2. Public complementary export** (`src/special/marcum-q.js`,
`src/special/index.js`):
Added a new named export `marcumP(mu, x, y)` returning `1 - Q_M(...)`
**without forming the subtraction**:

- `y === 0` → return `0` (complement of `marcumQ`'s `y=0 → 1`).
- `x === 0` → return `gammaLowerIncomplete(mu, y)` (complement of
  `marcumQ`'s `x=0 → gammaUpperIncomplete(mu, y)`; both are regularized).
- `y > x + mu` (q-branch primary, where Q is small) → return
  `1 - _seriesExpansion.q(mu, x, y)`. The subtraction here is safe
  because the subtracted quantity is small; relative error in the
  result is on the order of the q-series precision, not amplified.
- `y ≤ x + mu` (p-branch primary, where Q ≈ 1) → return
  `_pSeriesComplement(mu, x, y)` directly. This is the line that
  fixes the bug — the raw complement is returned without any
  subtraction-from-1.

The pattern follows existing codebase precedent:
`gammaLowerIncomplete` / `gammaUpperIncomplete` and `erf` / `erfc`.
No ADR was required — adding a complementary export alongside its
primary is an established convention in `src/special/`.

**3. Distribution call site** (`src/dist/noncentral-chi2.js`):
Replaced `return 1 - marcumQ(this.p.k / 2, this.p.lambda / 2, x / 2)`
with `return marcumP(this.p.k / 2, this.p.lambda / 2, x / 2)`. Added
a WHY comment referencing the cancellation mechanism and #245.

**4. Boundary refVals** (`test/dist-cases-continuous.js`):
Added `{ x: 1e-4, pdf: 1.552980522417813e-22, cdf: 2.8236187208673515e-27 }`
and `{ x: 1e-2, pdf: 1.546703572204263e-13, cdf: 2.813959235410335e-16 }`
to `NoncentralChi2.refVals`. Values from `scipy.stats.ncx2(11, 2)`
matching `cases[0]` parameters. Both CDF values are sub-precision and
exercised by the `refValTol` relative-tolerance fallback.

## Prevention Strategy

**Four prevention layers** (extending the framework established by
#243 and #244):

1. **Audit special functions for internal `1 - tiny` patterns, not just
   call sites.** When `_cdf` is `1 - F(...)` and `F` is a special
   function with a two-branch implementation, **read the source of
   `F`'s branches**, not just the top-level return type. If a branch
   computes the complement of what it returns (i.e., evaluates
   `1 - small_value` to deliver `near_1_value`), then the call site's
   subsequent `1 - F(...)` is a second cancellation — and the bug is
   invisible at the call site. The fix must live inside `F` (expose a
   complementary export) — it cannot be patched at the caller.

2. **Paired complementary exports as default convention.** When a
   special function in `src/special/` can natively compute either the
   primary or the complement (because it branches internally based on
   numerical regime), expose **both** as named exports from the start.
   Precedent: `gammaLowerIncomplete` / `gammaUpperIncomplete`,
   `erf` / `erfc`, and now `marcumQ` / `marcumP`. If only one form is
   exported and the other is computed via `1 - exported(...)`, you
   have set a trap for the next distribution that uses the
   complementary regime.

3. **Boundary refVals on every distribution whose `_cdf` calls a
   special function.** A refVal at the regime where the inner function
   approaches 0 or 1 catches the cancellation immediately. With
   `refValTol` already in place globally (from #243), the only thing
   needed is the data point itself. Per-distribution checklist: for
   every `_cdf` calling a regularized special function with an
   argument that grows or shrinks with `x`, add lower-tail and
   upper-tail refVals targeting the argument range where the inner
   function approaches its limits.

4. **Refactor that preserves bitwise output is verified by the
   existing recurrence-relation tests.** Extracting
   `_pSeriesComplement` from `_seriesExpansion.p` reconstructs the
   `marcumQ` value via `1 - helper(...)`. The arithmetic is bitwise
   identical (no constant folding intervenes), so the existing
   `marcumQ` recurrence tests at `test/special.js:328-395` serve as a
   regression envelope. Any complement-style refactor of a special
   function should preserve bitwise behavior of the original export
   and rely on the existing tests to confirm it, rather than rewriting
   the math.

## Related Solutions

- `solutions/correctness/2026-05-18-1133-inverse-chi2-cdf-complementary-gamma.md`
  (#243) — same class of bug, but the first subtraction lived inside
  `gammaLowerIncomplete`'s `x >= s+1` branch. Fixed by switching to
  `gammaUpperIncomplete` which routes to the continued-fraction `_gui`
  path directly. #245 generalizes this: the special function did NOT
  already export a complementary form, so one had to be added.
- `solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md`
  (#211) — analogous case in `erf` / `erfc` where the original
  delegation through `gammaLowerIncomplete` / `gammaUpperIncomplete`
  caused tail-precision loss. Fixed by switching to a direct hybrid
  Taylor/continued-fraction implementation. Same lesson: complementary
  paths inside special functions deserve direct, native computation —
  not derivation via subtraction.

## Key Insight

When a special function internally computes `1 - tiny` to deliver a
near-1 result, computing `1 - specialFunction(...)` at the call site
incurs a **second** cancellation — and the bug is invisible from the
call site because the first subtraction is hidden one stack frame
down. The fix must live inside the special function as a complementary
export that short-circuits before the first subtraction, not at the
distribution layer.
