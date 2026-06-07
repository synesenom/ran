---
date: 2026-06-07T17:48:00Z
category: "testing"
problem: "Per-distribution fit/moment assertions accreted as ~2000 lines of monolithic hand-written it() blocks, duplicating config already centralized in dist-cases-*.js"
status: complete
related_issue: "#740"
related_plan: "thoughts/plans/2026-06-07-1745-consolidate-fit-moment-configs.md"
tags: [test-infrastructure, data-driven-tests, tolerances, fit, moments, dist-cases, refactor]
---

# Solution: Data-driven fit and moment test configs

**Date**: 2026-06-07T17:48:00Z
**Category**: testing
**Related Issue**: #740

## Problem

`test/dist.js` carried two monolithic `describe` blocks — ~90 moment assertions and ~150
fit-recovery assertions — written as flat hand-coded `it()` blocks, entirely separate from the
per-distribution configuration already centralized in `dist-cases-continuous.js` /
`dist-cases-discrete.js`. Adding a distribution meant editing three locations (cases file for
pdf/cdf refs, the moments block, the fit block). The ~2000 lines were nearly-repetitive with no
enforced schema, so the distinction between a canonical parameter-recovery test and a
non-parametrizable edge case was invisible.

## Root Cause

The data-driven loop (`testCases.forEach(tc => describe(tc.name, () => UnitTests.*(tc)))`)
already drove constructor/seed/pdf/cdf/sample/test assertions, but `moments` and `fit` runners
were never added to it. Both were bolted on as imperative blocks at the bottom of the file, and
once the pattern existed each new distribution copied it rather than centralizing config — a
classic test-suite accretion pattern.

## Fix

Added `UnitTests.moments(tc)` and `UnitTests.fit(tc)` to the existing loop, plus optional
`moments` / `fit` fields on each dist-cases entry. Two design points proved important:

1. **Reconstruct expected fit values from `planted.p[name]`**, not hardcoded literals — build a
   fresh instance from the planted `params` and read its `.p`. The name→value mapping is then
   automatic and survives parameter renames or inherited/internal keys (e.g. `alpha`/`beta`
   inherited by `Erlang` from `Gamma`, `alpha2`/`beta2` on `GeneralizedNormal`).

2. **Support a per-moment `tol` object** (`{ mean, variance, skewness, kurtosis }`) in addition
   to a scalar. The first migration collapsed each test's per-moment tolerances into one loosest
   value, silently relaxing tight mean/variance checks (e.g. 1e-14 → 1e-11) by 2–3 orders of
   magnitude. Review caught this; the object form restores the original tolerances exactly.

Non-parametrizable cases were classified and intentionally retained as explicit `it()` blocks.

Cross-distribution moment cross-validation (e.g. `InverseChi2(ν)` vs `InverseGamma(ν/2, ½)`,
`Chi(3)` vs `MaxwellBoltzmann(1)`) was initially retained as hand-written, but on review was
**replaced by independent ref-value moment entries** for each distribution. A cross-check is an
internal-consistency test (A == B); a ref-value check is external ground truth (A == closed
form), which is strictly stronger — it also catches a bug shared by both implementations, which
a cross-check is blind to. The moment suite is therefore 100% config-driven.

## Prevention Strategy

- Add a data-driven runner the moment the *first* distribution needs it, not after N hand-written
  copies accumulate.
- Classification heuristic (codified in a schema comment): a **fit** test is parametrizable iff
  it asserts `result.p[name] ≈ planted.p[name]` (tolerance) or `=== planted.p[name]` (exact), or
  only `instanceof`, for scalar constructor params. Static-method tests (`_fitInit`/`_fitPenalty`),
  pdf-shape recovery, array/mixture params, profile-search, multi-case loops, and
  cross-distribution comparisons are non-parametrizable and stay as `it()` blocks. A **moments**
  test is parametrizable iff the expected value is a single finite number / `NaN` / `±Infinity`
  compared by absolute tolerance. A cross-distribution identity (A's moment == B's moment) is
  *not* a reason to keep a hand-written test: prefer an independent ref-value check on each side
  (external ground truth beats internal consistency and catches bugs shared by both).
- When collapsing per-assertion tolerances into a schema field, make the field support
  per-assertion granularity, or the loosest value silently weakens the tightest check.
- A regex-based migration extractor must recognize equivalent *syntactic* forms of the same
  assertion, or it leaves migratable tests behind: `&&`-combined comparisons, `<=` vs `<`, a
  transformed parameter (`result.p.nu + 1 - 6` ≡ `nu` vs planted `5`; `result.p.alpha * 2 === 4`
  ≡ `exact alpha`), and a proxy observable that equals a parameter (`pdf(1) === p` for Bernoulli).
  Conversely, a one-sided bound (`b > 3.5`), a validity range (`0 ≤ λ < 1`), a parameter *sum*
  (`k1 + k2`), a reparametrized internal key (Rayleigh stores `lambda2`, not `sigma`), or a `<=`
  boundary hit exactly (NoncentralT Δ = 1.0 under a strict-`<` runner) are genuinely
  non-parametrizable and must stay hand-written.

## Related Solutions

- `solutions/testing/2026-05-22-1820-per-distribution-gof-sample-size-override.md` — prior
  precedent for per-distribution overrides on the same data-driven loop.

## Key Insight

Collapsing per-assertion tolerances into a single scalar schema field silently weakens the
tightest checks by orders of magnitude; the schema must allow per-assertion tolerances so each
original precision level is preserved exactly.
</content>
