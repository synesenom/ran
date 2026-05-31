---
date: 2026-05-31T12:00:00Z
category: "correctness"
problem: "Six modules used `undefined` as a uniform failure sentinel instead of the ADR-0015 four-channel return-value convention"
status: complete
related_issue: "#593"
related_plan: "thoughts/plans/2026-05-31-1010-adr0015-la-stats-audit.md"
tags: [adr-0015, return-value, NaN, undefined, throw, Infinity, la, location, dispersion, shape, dependence, ts]
---

# Solution: ADR-0015 audit — la and statistics modules

**Date**: 2026-05-31
**Category**: correctness
**Related Issue**: #593

## Problem

Six modules (`src/la/`, `src/location/`, `src/dispersion/`, `src/shape/`, `src/dependence/`, `src/ts/`) predated ADR-0015 and used `undefined` as a uniform failure sentinel for every abnormal result. This produced wrong TypeScript declarations (`number | undefined` across a numeric API), silently corrupted `JSON.stringify` output (undefined keys are dropped; undefined array elements become `null`), and made it impossible for callers to distinguish a programming error (mismatched dimensions) from a mathematically indeterminate result (empty input, zero variance) or a divergent result (KL divergence with Q=0, P>0).

## Root Cause

The modules were written before ADR-0015 codified the four-channel return-value convention. A single `return undefined` was used for situations that actually fall into three distinct categories:
1. **Caller/programming errors** that should terminate with a thrown `Error`
2. **Valid queries with no finite answer** → `NaN`
3. **Valid queries whose answer diverges** → `Infinity`

Because all three looked the same at the call site, callers had no way to distinguish them, and tests asserted `typeof result === 'undefined'` — a predicate that passes for both `undefined` and implicit function fall-off, masking the underlying misclassification.

A hidden aggravating factor: `isNaN(undefined) === true` in JavaScript. Any test written as `assert(isNaN(f([])))` would pass whether `f` returned `NaN` or `undefined`, so converting `undefined` to `NaN` in the source would NOT make those tests start failing — they had to be migrated to `Number.isNaN()` simultaneously.

## Fix

Each `undefined`-returning site was reclassified into the correct ADR-0015 channel:

- **Dimension or length mismatch** (`la/` binary operations, `dependence/` mismatched-array-length guards) → `throw Error('...')`. These are caller errors.
- **Valid but indeterminate query** (empty array, single-element array, zero variance, zero spread, `0/0`) → `return NaN`.
- **Divergent result** (KL divergence with `q[i]=0, p[i]>0`; zero-denominator odds ratio) → `Infinity`, produced naturally by IEEE-754 arithmetic once the explicit `undefined` guard was removed.
- **Array-returning functions** (`mode`, `rank`) with empty input → `return []`, keeping the return type consistent (`number[]`, not a scalar sentinel).
- `OnlineCovariance.compute()` before any updates → `this.cov.scale(NaN)` (NaN-filled `Matrix`), keeping the return type uniformly `Matrix`.

Tests were updated in parallel:
- Length-mismatch cases: `typeof result === 'undefined'` → `assert.throws`
- Degenerate-input cases: `typeof result === 'undefined'` → `assert(Number.isNaN(result))`

## Prevention Strategy

1. **Always use `Number.isNaN(result)`** (not the global `isNaN()`) in tests that assert degenerate numeric output. `isNaN(undefined) === true` in JavaScript, so `isNaN()`-based tests pass silently whether the function returns `NaN` or `undefined`.

2. **Treat any `return undefined` in a numeric function as a blocking code-review comment** requiring explicit reclassification against the ADR-0015 table.

3. **Watch for implicit fall-off-end**: a function body that reaches its closing brace without a `return` statement silently returns `undefined` in JavaScript. This was the case in `variance.js`, `max.js`, and `min.js` — they had `if (condition) { ... }` with no `else`, so the empty-input path fell through.

4. **Separate the two kinds of bad input before writing a guard**: length/dimension mismatch (caller error → `throw`) vs. empty/degenerate input (valid query, indeterminate result → `NaN`). The original `isInvalidInput` helpers combined both into one predicate, erasing this distinction.

## Related Solutions

- [`solutions/correctness/2026-05-17-0847-validate-rejects-missing-params.md`](../correctness/2026-05-17-0847-validate-rejects-missing-params.md) — Distribution.validate() throw-for-caller-error pattern; the same ADR-0015 principle applied to constructor validation.
- [`solutions/algorithm/2026-05-20-0647-q-estimate-walk-infinite-support-discrete.md`](../algorithm/2026-05-20-0647-q-estimate-walk-infinite-support-discrete.md) — `undefined` escaping from `_qEstimateRoot` and converting to `NaN` via `Math.floor`; another pre-ADR-0015 undefined-sentinel bug.

## Key Insight

`undefined` as a numeric failure sentinel is undetectable by `isNaN()` tests, invisible to `JSON.stringify`, and forces `number | undefined` into generated TypeScript — all three problems vanish at once by distinguishing the two fundamentally different failure kinds: **throw** for caller errors (dimension mismatch), **`NaN`** for indeterminate math, and **`Infinity`** for divergent math.
