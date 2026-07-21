---
date: 2026-07-21T11:31:28Z
category: "testing"
problem: "A Monte Carlo validation script's Wald 95% CI silently reported ±0.00pp uncertainty for zero-count observations, understating risk in a citable JSDoc/CHANGELOG claim"
status: complete
related_issue: "#1054"
related_plan: "thoughts/plans/2026-07-21-1041-guess-soft-filter-false-exclusion-validation.md"
tags: [confidence-interval, wald-interval, wilson-score-interval, binomial-proportion, statistical-rigor, empirical-calibration, monte-carlo, boundary-case]
---

# Solution: A Wald confidence interval degenerates at zero-count observations — use Wilson score for any citable rate estimate

**Date**: 2026-07-21T11:31:28Z
**Category**: testing
**Related Issue**: #1054

## Problem

`scripts/guess-filter-validation.js` (issue #1054) is a Monte Carlo simulation measuring the empirical false-exclusion rate of `ran.dist.guess()`'s three soft pre-filters (skewness, coefficient of variation, dispersion index) across 5 sample sizes and 7 representative distributions, 10,000 seeded draws per configuration. Its first version reported uncertainty with the standard Wald interval, `rate ± 1.96·√(p̂(1−p̂)/n)`.

Three of the five filter categories (`CV_ONE_FAMILY`, `POISSON_LIKE`, `NEGATIVE_BINOMIAL_LIKE`) measured an observed exclusion count of exactly 0 out of 10,000 draws for their representative distribution. At `p̂ = 0`, the Wald formula's `√(p̂(1−p̂)/n)` term evaluates to `√0 = 0`, so the reported interval collapsed to exactly `±0.00pp` — mathematically claiming zero uncertainty about a rate that was only ever *observed* to be zero across a finite sample, not proven to be exactly zero. That number was about to become a permanently citable claim: the script's output directly backed a CHANGELOG bullet and a `src/dist/guess.js` JSDoc sentence asserting these filters are "well within safe bounds."

## Root Cause

The Wald interval is a normal approximation to the binomial sampling distribution, and that approximation breaks down near the `p̂ = 0` and `p̂ = 1` boundaries — a textbook, well-documented failure mode, not an edge case unique to this script. It has no way to express "we observed 0 successes in `n` trials, so the true rate is bounded above by roughly `3/n` (the rule of three), not literally 0."

This was invisible during planning: the design-propose/design-critique pass (see the plan doc's Design Decisions) evaluated and approved the Wald formula before any real data existed, reasoning about the skewness filter's ~5%-ish expected rate — never about the specific zero-count outcome three of the five categories would actually produce. A design review of a statistical formula that only checks it against the *expected* outcome will miss a failure mode that only appears at a *different* outcome the data happens to land on. The defect was a property of the measured data, not of the code as written at design time, so it was undetectable until the simulation actually ran — and even then, it took the `/review` pipeline's dedicated tests-domain reviewer (not the correctness, structure, or docs reviewers, who were all looking at different concerns) to notice the specific degenerate output.

## Fix

Replaced the Wald interval with the Wilson score interval:

```js
function wilsonInterval (rate, n) {
  const Z = 1.96
  const z2 = Z * Z
  const denom = 1 + z2 / n
  const center = (rate + z2 / (2 * n)) / denom
  const halfWidth = (Z * Math.sqrt(rate * (1 - rate) / n + z2 / (4 * n * n))) / denom
  return { ciLow: Math.max(0, center - halfWidth), ciHigh: Math.min(1, center + halfWidth) }
}
```

Wilson score stays valid and non-degenerate at `p̂ = 0`/`p̂ = 1`, producing a non-zero, rule-of-three-consistent upper bound (e.g. `[0.00%, 0.04%]` for a 0/10000 observation at n=10000) instead of a false `±0.00pp`. It's a drop-in replacement — same inputs (`rate`, `n`), same purpose — with no change to the measurement methodology itself, only to how the uncertainty around the measurement is reported. `scripts/guess-filter-validation.js:136-147` carries a WHY comment citing this exact degeneracy as the reason Wilson was chosen over the simpler Wald form.

## Prevention Strategy

Any validation or measurement script whose output is destined to become a documented, citable claim — a CHANGELOG entry, JSDoc prose, a README number, anything a future reader will trust without re-deriving it — must use an interval/uncertainty formula that stays valid across the *full range of outcomes the measurement could plausibly produce*, not just the range anticipated at design time. Default to the Wilson score interval (or an equivalent boundary-safe method, e.g. Clopper-Pearson) for any binomial rate estimate in this codebase; the Wald interval's boundary degeneracy makes it a poor default whenever a near-zero or near-one true rate is plausible, which is common in exactly this kind of false-exclusion-rate / false-positive-rate validation work.

When a design-propose/design-critique pass approves a statistical formula, explicitly test it against the boundary cases (`p → 0`, `p → 1`, small `n`) during that pass, not only against the expected/typical outcome — a formula that looks fine for the anticipated ~5% case can silently misreport certainty for the zero-count case the same script legitimately measures elsewhere in its own output table.

## Related Solutions

- `solutions/testing/2026-05-19-1132-gof-test-swap-effective-alpha-empirical-calibration.md` — establishes this codebase's precedent that a statistical test/formula's *nominal* behavior (α, or here the Wald interval's textbook validity) must be empirically checked against its *actual* behavior on real measured data before a claim built on it is trusted; this solution applies the same discipline one level down, to the uncertainty-reporting formula wrapped around a measurement rather than the measurement itself.

## Key Insight

When a statistical measurement script's output will be documented as a trusted claim, use a boundary-safe confidence-interval formula (Wilson score, not Wald) by default — "the true rate is near zero" is a common, entirely plausible outcome that the Wald interval silently misreports as "we have zero uncertainty about this."
