---
date: 2026-05-16T00:00:00Z
category: "testing"
problem: "cdf2pdf test fails non-deterministically when random test points land near PDF kinks"
status: complete
related_issue: "#139"
related_plan: "thoughts/plans/2026-05-15-2154-vonmises-cdf2pdf-precision.md"
tags: [cdf2pdf, ridders, richardson-extrapolation, kink, numerical-differentiation, non-deterministic, laplace, double-gamma, bates, trapezoidal]
---

# Solution: Ridders error estimate used to skip kink-crossing test points in cdf2pdf

**Date**: 2026-05-16
**Category**: testing
**Related Issue**: #139

## Problem

The `cdf2pdf` test in `test/test-utils.js` failed non-deterministically (~6–10% of runs) for
Laplace, DoubleGamma, Bates, and Trapezoidal distributions. The failures were not caused by
incorrect PDF or CDF implementations — the math was correct. The test infrastructure produced
bad derivative estimates when a randomly chosen test point fell within `H = 0.01` of a kink in
the PDF (a point where the first derivative of the PDF is discontinuous). The existing kink
guard (`|q1 - q2| > 1e-3`) was supposed to detect and skip such points but silently passed
them through, producing false assertion failures.

## Root Cause

The existing kink guard compared two centered finite-difference estimates at different step
sizes. This works for asymmetric kinks where `q1` and `q2` differ noticeably, but fails for:

- **Symmetric kinks** (Laplace at `mu`, DoubleGamma at `0`): the CDF's centered difference
  evaluates to approximately `pdf(mu)` regardless of step size due to mirror symmetry, so
  `q1 ≈ q2` always and the guard never triggers.
- **Shallow crossings** (Bates at rational boundary, Trapezoidal near slope change): the
  `|q1 - q2|` difference is too small to exceed the `1e-3` threshold.

Ridders' Richardson extrapolation internally computed a large `err` value signaling table
non-convergence in all these cases — but `differentiate` discarded it (`return ans`) instead
of returning it to the caller.

## Fix

Changed `differentiate` to return `[ans, err]` instead of `ans`, exposing Ridders' internal
Richardson-table convergence error. The `cdf2pdf` test destructures this pair and skips test
points where `dfErr > Math.max(PRECISION, Math.abs(df) * 1e-7)`.

For smooth CDFs, Ridders' error converges to `~1e-12–1e-14`. For kink-crossing cases:

| Distribution | Observed `dfErr` |
|---|---|
| Laplace (kink at mu) | ~4.56e-5 |
| DoubleGamma (kink at 0) | ~2.47e-4 |
| Bates (C² kinks at 1/3, 2/3) | ~2e-7 to 7e-6 |
| Trapezoidal (slope change) | ~2e-7 to 5e-7 |

All kink-crossing cases exceed `max(1e-9, |df| * 1e-7)` by at least 1 order of magnitude.
All smooth CDFs are 5+ orders of magnitude below the threshold. The fix is self-contained to
`test/test-utils.js` with no production code changes.

## Prevention Strategy

When using Ridders' Richardson extrapolation as a test oracle, always propagate the internal
error estimate rather than discarding it. The Richardson table non-convergence (`err` staying
large) is the canonical signal that the function has a kink inside the stencil — no external
heuristic comparing two coarse estimates can catch symmetric kinks.

The correct idiom for any `cdf2pdf`-style validator:

```javascript
const [df, dfErr] = differentiate(t => dist.cdf(t), x, H)
if (dfErr > Math.max(PRECISION, Math.abs(df) * 1e-7)) {
  continue  // Richardson table did not converge — kink in stencil
}
```

## Related Solutions

- `solutions/distribution/2026-05-15-1921-fisher-z-pdf-log-space-overflow.md` — documents a
  related `cdf2pdf` guard (`|df| < PRECISION`) for CDF saturation at tails.

## Key Insight

Ridders' Richardson extrapolation already computes a convergence error estimate internally —
discarding it (`return ans`) makes symmetric kinks invisible to any external guard; propagating
`err` and skipping when `err > max(PRECISION, |df| * 1e-7)` eliminates all kink-crossing
false failures while leaving smooth-CDF test points completely unaffected.
