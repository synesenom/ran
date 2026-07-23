---
date: 2026-07-22T16:00:00Z
category: "performance"
problem: "Does powell.js's shared outer/inner maxIter=15 budget under-serve DoublyNoncentralBeta/F.fit()'s inner Brent line search, and should it be decoupled?"
status: complete
related_issue: "#1078"
related_plan: "thoughts/plans/2026-07-22-1500-issue-1078-powell-line-search-budget.md"
tags: [doubly-noncentral-beta, doubly-noncentral-f, fit, powell, brent, line-search, likelihood-ridge, investigation]
---

# Solution: powell.js's shared outer/inner maxIter — investigated, kept coupled

**Date**: 2026-07-22T16:00:00Z
**Category**: performance
**Related Issue**: #1078

## Problem

Issue #1063 fixed `DoublyNoncentralBeta.fit()`/`DoublyNoncentralF.fit()`'s severe slowdown by bounding Powell's search budget via `_powellOptions()` (`{ tol: 1e-2, maxIter: 15 }`), only spot-checked against 3 parameter-set/seed combinations. `powell.js`'s `opts.maxIter` bounds *both* the outer Powell conjugate-direction loop and every inner 1-D Brent line search (`lineOpts = { tol, maxIter }`, `src/algorithms/powell.js:271`, reused unchanged in both `brentMin`'s own loop and the outer sweep). Issue #1078 (Concern 3) asked whether this coupling starves the inner Brent line search — 15 iterations is comparatively tight for a 4-parameter fit — causing observable under-convergence on data broader than #1063's original spot-check, and whether the budgets should be decoupled (e.g. a `lineMaxIter` option) if so.

## Investigation

A temporary, non-committed hook was added to `powell.js` (`globalThis.__LINE_MAXITER_OVERRIDE__`, reverted before any commit) to let a throwaway script toggle the inner Brent budget independently of the outer loop's `maxIter`, without touching any other call site. Two variants of `DoublyNoncentralBeta.fit()`/`DoublyNoncentralF.fit()` were run and compared:

- **Bounded** (current behavior): inner Brent capped at 15, matching outer `maxIter`.
- **Decoupled** (experimental): inner Brent capped at 200 (the base-class default), outer `maxIter` left at 15.

**Well-matched data** — 7 parameter sets (`DoublyNoncentralBeta(2,3,1,1)`, `(5,5,2,2)`, `(1,1,5,5)`, `(10,10,0.5,0.5)`, `(2,8,3,1)`; `DoublyNoncentralF(3,8,1,1)`, `(5,5,2,2)`) x 5 seeds each (n=500/400), sampled directly from the target distribution:

- All 35 runs produced **bit-identical** results between bounded and decoupled budgets (log-likelihood matching to 6 decimal places). `maxIter=15` is not starving the inner Brent line search on data that genuinely belongs to this family — the outer Powell loop's own `tol=1e-2`/`maxIter=15` convergence bound is reached first, well before any single line search would need more than 15 Brent iterations.

**Family-mismatched data** — the exact #1063 reproduction, `Rice(5,1)`-sampled data (n=500) fit via `DoublyNoncentralF.fit()`, 5 seeds:

- 4 of 5 seeds completed within the investigation's time budget; the decoupled budget achieved a **substantially better** log-likelihood in every completed case (+16.6%, +31.9%, +31.4%, +31.3% relative to the bounded budget's `-lnL` magnitude) — real, measurable under-convergence on this data.
- The 5th seed's decoupled run did not complete within the investigation's 500s window (everything else, including the other 39 runs, finished comfortably inside it) — strong evidence that raising the inner Brent budget on this specific near-flat, near-unidentifiable ridge surface reintroduces materially higher cost, consistent with the #1063 root cause: each step further along the ridge is itself more expensive to evaluate (larger non-centrality parameters require more series terms per `_pdf` call), so a larger per-line-search budget lets Powell chase the ridge further, at compounding cost, exactly on the data #1063's fix targets.

## Conclusion

The shared `maxIter=15` budget is **not** an accidental conflation to be fixed — on the one class of data where it matters (family-mismatched, ridge-shaped log-likelihood surfaces), it is doing exactly what #1063 designed it to do: trading convergence quality for a bounded worst-case cost. Decoupling and raising the inner Brent budget would recover some of that quality back, but at the risk of reintroducing the multi-second-plus-per-fit cost #1063 was filed to eliminate, on the same data. On well-matched data, the coupling causes no quality loss at all, since the outer loop's own bound is always reached first.

**Decision**: keep `maxIter=15` coupled (no `lineMaxIter` mechanism added). This is a documented, deliberate tradeoff, not a defect — extending `_powellOptions()`'s existing JSDoc (`src/dist/doubly-noncentral-beta.js`) with this finding closes out issue #1078's Concern 3 without a code change.

## Prevention Strategy

Before decoupling any optimizer-in-the-loop budget on a distribution known to have a near-flat likelihood ridge (see `solutions/performance/2026-07-22-0702-doubly-noncentral-fit-powell-ridge-cost.md`), measure the *specific* data the original cost bound was calibrated against, not just well-matched data — a change that looks like a pure quality improvement on well-behaved inputs can silently reintroduce a cost regression on exactly the pathological inputs the original fix targeted. This mirrors the #1063 log's own lesson (a plausible, two-agent-confirmed hypothesis was empirically wrong) applied one level up: a plausible, issue-reporter-confirmed hypothesis ("decoupling should only help") was also empirically incomplete once measured against the right data.

## Related Solutions

- `solutions/performance/2026-07-22-0702-doubly-noncentral-fit-powell-ridge-cost.md` — the original #1063 fix and the `maxIter=15` calibration this investigation re-verified.
- `decisions/0017-beta-fit-penalty.md` — precedent for the `_powellOptions()`-style protected static hook pattern.

## Key Insight

A shared iteration budget across two nested optimizer loops is not automatically a bug just because it's "coupled" — measure whether decoupling actually helps on the data the coupling was calibrated against before adding a knob nobody has shown is needed. Here, the coupling turned out to be load-bearing on exactly the case it was designed for.
