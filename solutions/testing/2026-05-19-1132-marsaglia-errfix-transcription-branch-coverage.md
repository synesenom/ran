---
date: 2026-05-19T11:32:00Z
category: "testing"
problem: "Marsaglia errfix middle-piece transcription bug survived all downstream tests because the unit-test reference point exercised a different piecewise branch"
status: complete
related_issue: "#184"
related_plan: "thoughts/plans/2026-05-19-0759-issue-184-anderson-darling-replace-ks.md"
tags: [anderson-darling, marsaglia, polynomial-transcription, piecewise, horner, branch-coverage, gof-test]
---

# Solution: Marsaglia errfix transcription bug & branch-targeted reference tests

**Date**: 2026-05-19T11:32:00Z
**Category**: testing
**Related Issue**: #184

## Problem

When the Anderson–Darling goodness-of-fit helper landed in `test/test-utils.js`, the `_errfix` middle-piece scaling factor had two simultaneous transcription errors versus Marsaglia & Marsaglia (2004), JSS 9(2):

```js
// wrong
return (0.04123 / n + 0.01365 / (n * n)) * g2
```

1. `0.04213` was written as `0.04123` — a digit transposition (positions 2 and 3 swapped).
2. `0.01365 / n³` was written as `0.01365 / n²` — one factor of `n` missing from the denominator.

The five-test unit suite for `adTest` passed. The 107-distribution × 3-seed sampling suite passed. The bug was caught only when a `review-correctness` subagent re-expanded the published C and the JavaScript transcription into monomial form and diffed term-by-term.

## Root Cause

Marsaglia's published C reads:

```c
return t*(.04213 + .01365/(n*n))/n;
```

The outer `/n` divisor applies to the entire bracketed expression, so the mathematical form is `0.04213/n + 0.01365/n³`. When transcribing the nested form to flat JavaScript, the outer divisor was carried into the first term correctly but not distributed through the second. The digit transposition (`04213` → `04123`) is a separate look-alike substitution that occurred independently of the structural error.

Why the tests missed it:

- The hand-computed reference sample `[0.1, 0.3, 0.5, 0.7, 0.9]` produces `A² ≈ 0.13`, which gives `_adinf(A²) ≈ 0`. That value falls in the **first** piecewise branch of `_errfix` (`x < c = 0.01265 + 0.1757/n`), exercising the `g1` formula — not the `g2` formula where the bug lived.
- The downstream 107-distribution sampling suite calls `adTest` at α = 0.001 with N = 5000. At those parameters, `_errfix` produces a correction on the order of 10⁻⁵–10⁻⁴, which is small relative to the decision boundary p − α. A ~2% relative error in the middle-piece scaling factor does not push any individual assertion across the boundary.

The bug was therefore latent — observable to a reviewer with the paper in hand, invisible to the test suite.

## Fix

Restored the published Marsaglia form:

```js
// correct — see Marsaglia & Marsaglia (2004), eqn (5)
return (0.04213 / n + 0.01365 / (n * n * n)) * g2
```

## Prevention Strategy

When transcribing nested-multiply (Horner-form) expressions or any expression with an outer divisor over a parenthesised bracket — `t*(A + B/n²)/n`, `(A + B*x)/(1 + C*x)`, etc. — apply two checks:

1. **Expand to monomial form before writing code.** Convert both the source and the transcription into flat sums of terms (`A/n + B/n³`, not `t*(A + B/n²)/n`) and diff the monomials. The collapsed source form hides distributive errors; the expanded form makes them syntactically visible.

2. **Write a branch-targeted reference test for every piecewise branch.** A single end-to-end pass/fail test is not enough for piecewise polynomial corrections. For each branch, pick a reference input that falls strictly inside it, compute the expected output by hand or against a trusted implementation, and assert at a tight tolerance (~1e-10). For `_errfix` specifically:

   - Branch 1 (`x < c`) — small A², covered by the existing 5-sample reference.
   - Branch 2 (`c ≤ x < 0.8`) — moderate A² (e.g. n=20, A² ≈ 1.0 → x ≈ 0.4) — **was not covered, hence the bug**.
   - Branch 3 (`x ≥ 0.8`) — large A² near the rejection boundary.

3. **Treat coefficient blocks as code, not data.** When pulling polynomial coefficients verbatim from a paper, cite the paper, equation number, and the original C/Fortran source in a comment. Reviewers can then verify against the citation without re-deriving.

## Related Solutions

- `solutions/testing/2026-05-16-ridders-error-estimate-kink-detection.md` — analogous lesson on piecewise-numerical corner cases needing explicit guards.

## Key Insight

A transcription bug in a piecewise correction survives every downstream test when no unit-test input lands inside the affected branch — branch-targeted reference tests are mandatory for piecewise polynomial code, not optional.
