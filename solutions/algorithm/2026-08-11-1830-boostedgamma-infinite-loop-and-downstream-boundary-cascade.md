---
date: 2026-08-11T18:30:00Z
category: "algorithm"
problem: "boostedGamma infinite-looped for tiny gamma shape parameters, and fixing its termination exposed three further downstream distributions with untested arithmetic at the newly-reachable boundary value"
status: complete
related_issue: "#1384, #1386"
related_plan: "thoughts/plans/2026-08-11-1600-boostedgamma-infinite-loop-tiny-shape.md"
tags: [gamma, beta, boost-branch, rejection-sampling, underflow, overflow, infinite-loop, termination, ieee-754, boundary-value, downstream-cascade, poisson, adr-0054, adr-0049]
---

# Solution: boostedGamma infinite loop and its downstream boundary-value cascade

**Date**: 2026-08-11T18:30:00Z
**Category**: algorithm
**Related Issue**: #1384, #1386

## Problem

`boostedGamma` (the shape<1 gamma sampler's `X·U^(1/a)` boost identity in `src/dist/_gamma.js`) infinite-looped for shape parameters below `a* ≈ 3.13e-13` — e.g. `new ran.dist.Gamma(1e-15, 1).sample()` hung forever. The `while (result === 0)` rejection-and-redraw guard added by the immediate predecessor fix (#1379) assumed retrying could eventually succeed. Below `a*`, every one of the xoshiro128+ PRNG's `2^32` possible outputs underflows the boost factor to exact `0.0` — the loop's acceptance probability is provably zero, so it never terminates. `InverseGamma`, `BetaPrime`, and `StudentT` had the mirror-image problem in their own downstream reciprocal/ratio rejection loops (also #1379-era).

Fixing that termination bug did not, by itself, finish the job. Across three separate `/review` passes in the same session, fixing the sampler's termination successively exposed:
1. `src/dist/_beta.js` had no rejection guard at all — once the underlying gamma draw became deterministically `0` for doubly-tiny shape parameters, `Beta(1e-15, 1e-15).sample()` started silently returning `NaN` on every draw.
2. `BetaPrime`'s existing guard converted the same doubly-tiny case to a fixed, direction-blind `Number.MAX_VALUE` sentinel rather than the mathematically correct saturation direction (the root cause separately filed as #1386).
3. Once `_beta.js` itself stopped hanging and started returning exact boundary values (`0`/`1`), two further distributions built on top of it broke in new ways that had never been reachable before: `BetaGeometric.sample()` divided by `Math.log(1-p)` where `p=0` gives `Math.log(1)=+0`, and `(negative)/(+0)` rounds to `-Infinity` in IEEE-754 — the wrong sign (the true answer diverges to `+Infinity`) and outside the distribution's declared `{1,2,3,...}` support. `BetaNegativeBinomial.sample()` fed its Beta draw into a Gamma-Poisson mixture that drove `_poisson.js`'s `lambda` to `Infinity`; the large-lambda branch divided by `sqrt(lambda)`, silently produced `NaN`, and fell off the end of its trial loop with no return statement — an explicitly forbidden `undefined` sentinel per this project's own return-value conventions.

## Root Cause

The #1379 fix treated "loop ran a long time without success" as the only failure mode of rejection sampling and added a redraw-until-success guard with no escape hatch for the case where success has *zero* probability across the PRNG's entire finite output space — a case that is analytically provable in closed form (from the PRNG's 32-bit resolution and float64's underflow boundary), not merely empirically unlikely. That gap alone would have been a self-contained fix.

But the fix's own success is what surfaced the second, structurally different root cause: three layers of downstream consumers contained arithmetic that had never been reachable with real inputs while the upstream sampler hung. `_beta.js`'s missing guard, `BetaGeometric`'s `log(1-p)` sign flip, and `_poisson.js`'s unguarded large-lambda fallthrough were all latent, untested defects — not because anyone made a mistake writing them, but because the old infinite loop acted as an unintentional guard that made those exact code paths unreachable for the library's entire lifetime. Removing the hang is precisely what made them reachable.

## Fix

1. Rewrote `boostedGamma`'s boost factor in log-space (`exp(ln(X) + ln(U)/a)` instead of `X · U^(1/a)`) to defer exponentiation and avoid intermediate underflow, plus an analytic short-circuit that returns the correctly-rounded `0` directly (not via a loop) when `a < a*`, since the outcome is provably `0` for every possible draw. A generous `BOOST_MAX_ITER` cap backstops the region above `a*` where acceptance probability is merely small, not zero ([ADR-0054](../../decisions/0054-boosted-gamma-analytic-underflow-boundary-return.md), narrowly extending [ADR-0049](../../decisions/0049-continued-fraction-convergence-throw.md)'s "throw on exhausted budget" default only where the boundary is analytically forced).
2. Capped the downstream reciprocal/ratio loops in `InverseGamma`/`BetaPrime`/`StudentT` at `MAX_ITER=100`, returning `Infinity` (not `Number.MAX_VALUE` — corrected during `/review` per CLAUDE.md's return-value table; the true answer is unboundedly beyond `MAX_VALUE`, not in the razor-thin IEEE-754 band that rounds down to it).
3. Added a rejection guard to `_beta.js` (which had none) and fixed `BetaPrime`'s existing guard, both deriving the correct **saturation direction** analytically from the small-shape gamma tail asymptotic (`ln(X/Y) ≈ E_y/b − E_x/a`) rather than a fixed sentinel — the smaller shape parameter's draw dominates the vanishing race and pulls the ratio toward the *opposite* boundary; equal shapes resolve via a coin flip.
4. Audited and fixed the two further downstream consumers exposed once `_beta.js` stopped hanging: `BetaGeometric` (`p === 0` guard, fixing the sign flip) and `_poisson.js` (`lambda === Infinity` guard at the top of the function, fixing the silent `undefined` fallthrough — a strict improvement for all ~11 of its callers, since `lambda = Infinity` was never handled correctly by any of them before this fix).

## Prevention Strategy

For rejection-sampling termination bugs: distinguish "loop exhausted a budget" (ADR-0049 default: throw) from "the boundary outcome is provable in closed form for every value the PRNG's finite output space can produce" (ADR-0054's narrow exception: short-circuit to the true value, don't loop at all). Never generalize the exception by analogy to a new sampler — re-derive the proof independently each time.

For the cascade: **when a fix changes a function's termination or return-value behavior at a boundary that was previously unreachable, audit every downstream consumer's arithmetic at that specific boundary value before considering the fix complete** — not just the function that was directly patched. A hang can act as an unintentional guard that has kept buggy downstream code paths untested for the library's entire lifetime; removing the hang is exactly what makes those paths newly reachable. A single check worth adding to the review checklist for any "fix a hang / fix a silent-wrong-value bug at a numeric boundary" change: trace every caller of the fixed function transitively, and check its arithmetic at the new boundary value (not just at "normal" values) before shipping.

## Related Solutions

- [solutions/distribution/2026-08-11-1014-gamma-boost-branch-underflow-and-subnormal-reciprocal.md](../distribution/2026-08-11-1014-gamma-boost-branch-underflow-and-subnormal-reciprocal.md) (issue #1379) — the direct predecessor, marked `superseded` by this solution: its Prevention Strategy correctly identified the "audit both ends of a magnitude-amplifying composition" pattern but did not anticipate that fixing a hang itself can expose previously-unreachable downstream consumers multiple layers deeper than the composition it was auditing.

## Key Insight

Fixing a sampler's infinite loop doesn't just fix the loop — the newly-reachable boundary value can expose previously-untested arithmetic bugs multiple layers downstream (here, three: `_gamma.js` → `_beta.js` → `beta-geometric.js`/`beta-negative-binomial.js`/`_poisson.js`), so a termination fix's real completion criterion is a transitive audit of every consumer's behavior at that exact boundary, not just verifying the original hang is gone.
