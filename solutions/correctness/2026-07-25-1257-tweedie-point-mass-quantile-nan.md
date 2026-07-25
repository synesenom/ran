---
date: 2026-07-25T12:57:07Z
category: "correctness"
problem: "Tweedie.q(p) silently returns NaN for any p at or below the point mass P(Y=0)"
status: complete
related_issue: "#1136"
related_plan: "thoughts/plans/2026-07-25-1117-tweedie-distribution.md"
tags: [quantile, point-mass, root-finding, _qEstimateRoot, tweedie, distribution-checklist]
---

# Solution: missing `_q(p)` override for a boundary point mass

**Date**: 2026-07-25T12:57:07Z
**Category**: correctness
**Related Issue**: #1136

## Problem

`Tweedie(mu, phi, p).q(p)` silently returned `NaN` for any probability `p` at or below the
distribution's point mass `P(Y=0) = exp(-lambda)` — e.g. `q(0.001)` on a Tweedie instance whose
zero-probability was `0.05` returned `NaN` instead of `0`. `_pdf`/`_cdf` were fully correct, and
the initial implementation's test suite passed 8180/8180. No automated test caught it, because
none of the `dist-cases-continuous.js`/`precision-continuous.js` probability points for the
initial 3 parameter sets happened to land at or below that parameter set's point-mass probability.
It was found only by a correctness-focused code-review pass reasoning explicitly about the
point-mass boundary — not by lint, type-checking, `Distribution.validate()`, or the existing test
harness.

## Root Cause

`Tweedie` shipped with no `_q(p)` override, so the base class's default `_qEstimateRoot`
(`src/dist/_distribution.js`) ran automatically. That method solves `cdf(x) - p = 0` by expanding
a bracket `[a, b]` from the support boundary until it finds a sign change, then runs Chandrupatla's
method — and explicitly returns `NaN` if no sign change is ever found. Tweedie's support is closed
at `0`, so the bracket's lower end is pinned at `a = 0`, giving `fa = cdf(0) - p = exp(-lambda) - p`.
Because `cdf` is monotone non-decreasing, `cdf(x) >= cdf(0)` for every `x` in the support, so
`fb = cdf(b) - p >= fa` for every candidate `b` the expansion tries — the two never straddle zero
whenever `p <= exp(-lambda)`.

The planning phase's decision to omit `_q(p)` was based on the reasoning "no closed form exists —
the base class's Chandrupatla root-finder on `_cdf` handles it." That conflated two different
questions: *does a closed-form inverse exist* (no) and *does the generic numeric root-finder even
satisfy its own preconditions* (also no, but for an unrelated reason — a CDF discontinuity at the
boundary, not the absence of a closed form). CLAUDE.md's `_q(p)` checklist row ("Implement whenever
the inverse CDF has a closed form... Omit only when numerical inversion is genuinely the only
option") doesn't call out this failure mode either.

## Fix

Added an explicit `_q(p)` override that special-cases the point-mass region and falls through to
the generic root-finder above it:

```js
_q (p) {
  // cdf(x) - p >= 0 for every x >= 0 whenever p is at or below the point mass P(Y=0), so the
  // base class's root-finder never finds a sign change and returns NaN; the correct quantile
  // there is the support's lower boundary itself.
  if (p <= Math.exp(-this.c.lambda)) {
    return 0
  }
  return this._qEstimateRoot(p)
}
```

Added regression coverage in `test/dist-cases-continuous.js`'s `quantileVals` for `p` at and
strictly below the point-mass probability.

## Prevention Strategy

1. **Checklist gap**: any distribution whose support has a point mass or other CDF discontinuity
   at (or below) a boundary needs an explicit `_q(p)` override for that region *regardless of
   whether a closed form exists for the continuous part* — `_qEstimateRoot`'s bracket-expansion
   cannot find a sign change there no matter how numerically it's approached. "No closed form" is
   not the same question as "does the generic root-finder's precondition hold."
2. **Test gap**: this bug class is invisible to `npm test` unless a probability point is
   specifically chosen at or below the point mass. Any new distribution shaped like this
   (compound-Poisson, zero-inflated, Tobit-type, spike-and-slab) should get at least one
   `quantileVals` entry with `p` strictly below the point mass's cumulative probability, added
   deliberately during the red phase of TDD — not left to chance parameter selection.

## Related Solutions

None found with the same failure mode; see the companion
`solutions/correctness/2026-07-25-1257-tweedie-series-peak-exceeds-fixed-iter-cap.md` for a
different bug class caught in the same review pass.

## Key Insight

`_qEstimateRoot`'s bracket-expansion root-finder silently returns `NaN` — not an error, not caught
by `validate()`, not implied by "no closed form exists" — whenever the CDF has a point mass at a
support boundary and `p` falls at or below that mass's cumulative probability, because
`cdf(x) - p` never changes sign anywhere in the support; any distribution with a boundary point
mass needs an explicit `_q(p)` override for that region even when no closed form exists for the
continuous part.
