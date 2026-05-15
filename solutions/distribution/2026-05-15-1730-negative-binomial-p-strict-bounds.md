---
date: 2026-05-15T17:30:05Z
category: "distribution"
problem: "NegativeBinomial accepted p=0 and p=1 silently instead of throwing"
status: complete
related_issue: "#138"
related_plan: "thoughts/plans/2026-05-15-1721-issue-138-negative-binomial-validation.md"
tags: [parameter-validation, probability-bounds, negative-binomial, strict-inequality, constructor]
---

# Solution: NegativeBinomial strict p bounds

**Date**: 2026-05-15T17:30:05Z
**Category**: distribution
**Related Issue**: #138

## Problem

The `NegativeBinomial` constructor accepted `p = 0` and `p = 1` without throwing, despite
both values producing a broken distribution. The test fixture in `test/dist-cases.js` correctly
listed both as `invalidParams`, so the constructor validation test failed with:

```
AssertionError: expected [Function] to throw an error
  at forEach (test/dist.js:18:22)
```

## Root Cause

The constraint strings passed to `Distribution.validate()` used inclusive bounds:

```js
'p >= 0', 'p <= 1'
```

The boundary values are mathematically degenerate:
- `p = 0` → `1 / this.p.p - 1 = Infinity` in the Gamma-Poisson sampler; `Math.log(p)` → `-Infinity` in the PMF
- `p = 1` → `Math.log(1 - p) = -Infinity` so the PMF is zero for all k — not a valid distribution

The inclusive bounds were inconsistent with every other probability-parameter distribution
in the codebase (`Bernoulli`, `Binomial`, `Geometric` all use strict bounds).

## Fix

Two token replacements in `src/dist/negative-binomial.js`:

```js
// Before
'p >= 0', 'p <= 1'

// After
'p > 0', 'p < 1'
```

JSDoc updated from `$p \in [0, 1]$` to `$p \in (0, 1)$` to stay consistent with the
enforced bounds. No test changes — the fixture was already correct.

## Prevention Strategy

For any distribution whose sampler or PMF/PDF contains `1/p` or `Math.log(p)`:

1. Default to **strict** bounds `'p > 0', 'p < 1'` unless boundary values are provably
   non-degenerate.
2. Cross-check constraint strings against `invalidParams` entries in `test/dist-cases.js`
   before merging — a mismatch is always a bug in one of them.
3. Check sibling distributions for precedent: if `Bernoulli`, `Binomial`, and `Geometric`
   all use strict bounds, a new probability-parameter distribution should too.

## Related Solutions

No related past solutions found.

## Key Insight

For distributions whose sampler contains `1/p`, `p = 0` must be excluded via a strict lower
bound — `1/p - 1` evaluates to `Infinity` silently rather than throwing, making downstream
failures non-obvious.
