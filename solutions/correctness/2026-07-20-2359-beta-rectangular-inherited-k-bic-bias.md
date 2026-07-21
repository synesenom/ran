---
date: 2026-07-20T23:59:27Z
category: "correctness"
problem: "BetaRectangular silently inherited k=2 from Beta despite having 5 free parameters, biasing every .aic()/.bic() call"
status: complete
related_issue: "#813, #1049"
related_plan: "thoughts/plans/2026-07-20-2009-guess-distribution-ranking.md"
tags: [distribution, subclass-inheritance, k, aic, bic, guess, reparametrization]
---

# Solution: BetaRectangular's inherited parameter count silently biased BIC comparisons

**Date**: 2026-07-20T23:59:27Z
**Category**: correctness
**Related Issue**: #813, #1049

## Problem

While sanity-checking `ran.dist.guess()`'s default candidate pool against literal `Normal(5, 2)`-generated data, `BetaRectangular` (a 5-free-parameter distribution) implausibly outranked `Normal` by BIC weight — a strong empirical red flag, since BIC's whole purpose is to penalize exactly this kind of over-flexible win against a known-true, simpler generating distribution.

## Root Cause

`BetaRectangular extends Beta` and its constructor calls `super(alpha, beta)`, which invokes `Beta`'s constructor and sets `this.k = 2` (via `super('continuous', 2)` inside `Beta`). `BetaRectangular` then merges three more parameters (`theta`, `a`, `b`) into `this.p` via `Object.assign`, but never touched `this.k` — so every `.aic()`/`.bic()` call computed its complexity penalty as if it had 2 parameters instead of 5, systematically under-penalizing it in any BIC/AIC-based comparison, not just inside `guess()`.

This is the **third** occurrence of the same architectural hazard in this codebase: a `Distribution` subclass that reparametrizes its parent's constructor (`super(transformed_args)`) to reuse the parent's `_pdf`/`_cdf`/`_generator` machinery inherits *every* instance field the parent constructor sets — not just the ones the subclass author consciously thinks about. Previous instances hit `static _fitInit` (`solutions/correctness/2026-05-28-1851-reparametrizing-subclass-inherits-wrong-fitinit.md`) and `this.p`/`params()` (`solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md`); this one hits `this.k`. The bug is invisible under ordinary testing because `.pdf()`/`.cdf()`/`.sample()` all still work correctly — only a field that's set once in the parent constructor and never exercised by the subclass's own overridden methods (`k`, used only inside `.aic()`/`.bic()`/`fit()`'s arity-based fallback) silently carries the wrong value forward.

A follow-up bug-triage audit found the identical pattern in at least 4 more distributions, tracked separately in issue #1049: `PERT` (`extends Beta`, should be k=3 for `a,b,c`, still k=2), `SkewNormal` (`extends Normal`, should be k=3 for `xi,omega,alpha`, still k=2), `Bates` (`extends IrwinHall`, should be k=3 for `n,a,b`), and `BetaBinomial` (`extends Categorical`, should be k=3 for `n,alpha,beta`).

## Fix

`BetaRectangular`'s constructor now explicitly sets `this.k = 5` immediately after `super(alpha, beta)`, matching the established override pattern already used at `src/dist/chi2.js:27`, `src/dist/truncated-normal.js:28`, and `src/dist/generalized-gamma.js:26`. A regression test asserts both the corrected `.k` value and its actual observable consequence (`.bic()`'s computed value using the 5-parameter penalty). The other four affected distributions were deliberately **not** fixed in this PR — doing so would have pushed scope beyond the single-concern/400-line PR limit for issue #813 — and are tracked in the separate follow-up issue #1049.

## Prevention Strategy

Whenever a `Distribution` subclass calls `super(...)` with a **transformed/reparametrized** argument list (different arity or different meaning than its own constructor parameters), treat it as a checklist trigger to explicitly audit and override *every* instance field the parent constructor sets that the subclass doesn't already override on its own terms:
- `this.p` (natural params) — covered by the 2026-06-07 solution.
- `static _fitInit` — covered by the 2026-05-28 solution.
- **`this.k`** (parameter count) — verify `this.k` equals the subclass's own true free-parameter count whenever the constructor accepts more (or fewer, or differently-named) parameters than it forwards to `super()`.

The most efficient detection method demonstrated in this session: **if a flexible/high-parameter-count candidate implausibly wins a BIC (or AIC) comparison against a known-true, simpler generating distribution, suspect a wrong `this.k` before suspecting the ranking/weighting math itself.** BIC weight is exponentially sensitive to `k` (`Δ` includes `k·ln(n)` inside `exp(-0.5·Δ)`), so an under-reported `k` produces a large, easily-noticed, wrong-direction bias — a cheap and reliable tripwire.

A worthwhile mechanical prevention step for a future issue: a repo-wide regression test asserting `new Cls(...).k === Cls's own constructor.length` for every subclass whose `super()` call passes a different number of arguments than its own constructor declares would catch all remaining instances of this exact family in one pass, rather than waiting for each to surface empirically one at a time.

## Related Solutions

- `solutions/correctness/2026-05-28-1851-reparametrizing-subclass-inherits-wrong-fitinit.md` — same hazard family, hit `static _fitInit`.
- `solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md` — same hazard family, hit `this.p`/`params()`.

## Key Insight

In this codebase's `Distribution` hierarchy, "reparametrizing subclass calls `super()` and forgets to override an inherited instance field" is a recurring bug family — `this.k` is simply the next field in that family, and an implausible BIC/AIC ranking win by a high-parameter-count candidate is the most efficient empirical tripwire for finding it.
