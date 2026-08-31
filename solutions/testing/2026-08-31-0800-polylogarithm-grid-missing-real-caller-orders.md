---
date: 2026-08-31T08:00:00Z
category: "testing"
problem: "Curated precision grid for polylogarithm sampled a 'representative' set of orders (n=1,3,8) instead of the exact orders the only real caller uses (n=2,3,4,5), silently missing an accuracy gap"
status: complete
related_issue: "#1414 (fixed inline), #1421 (related riemannZeta defect, filed separately, unfixed)"
related_plan: "thoughts/plans/2026-08-31-0710-zeta-polylog-eval-bridge.md"
tags: [precision-gate, wynn-epsilon, polylogarithm, grid-design, test-coverage, convergence]
---

# Solution: polylogarithm precision grid missed the exact orders real callers use

**Date**: 2026-08-31
**Category**: testing
**Related Issue**: #1414

## Problem

While extending `scripts/precision-refs-special.py`'s mpmath-based precision gate to cover `polylogarithm(n, z)` (issue #1414), two related gaps surfaced:

1. A genuine production accuracy defect: `polylogarithm(1, z)` — Li₁(z), computed via the same unconditional Wynn-epsilon-accelerated series every other order uses — lost significant accuracy as `z → 1` (relative error ~1.03e-4 at `z=0.99`, ~3.5% at `z=0.999`), an order of magnitude worse than the same mechanism at `n=3`.
2. A test-design gap found only during `/review`, after the fix for (1) had already shipped: the initial curated grid sampled `n ∈ {1, 3, 8}` as a "representative" spread. But the only real caller in the codebase, `ExponentialLogarithmic` (`src/dist/exponential-logarithmic.js:45-48`), calls `polylogarithm(2, z)` through `polylogarithm(5, z)` — orders 2, 4, and 5 had zero curated coverage. Adding them required six new named tolerance constants, because even the "interior" `z=0.9` probe (not just the near-`z=1` cluster) needed an override for `n=2, 4, 5` — a degradation invisible at the two orders (`n=3, 8`) the original grid happened to sample.

## Root Cause

Both gaps trace to the same fact: Wynn-epsilon extrapolation quality for `polylogarithm` is a continuous function of the order `n` (lower `n` → slower per-term decay `k^(-n)` → worse acceleration), not a constant across orders. A grid built from a handful of "representative" `n` values implicitly assumes accuracy is roughly uniform, or that a sparse sample characterizes the whole range. Neither held here: `n=1` was bad enough to be a real bug, and `n=2` — immediately adjacent to the sampled `n=3` — needed its own override, a gradient invisible from `n=3` or `n=8` alone. The specific orders the original design skipped (2, 4, 5) happened to be exactly the ones production code depends on.

## Fix

Two parts, following the established precedent in `solutions/special-functions/2026-05-28-0000-besselISpherical-small-x-taylor.md` (when a general algorithm loses accuracy in a specific degenerate regime, add a closed-form/alternate branch for that regime rather than tuning tolerances):

- **The production bug**: added a closed-form early return to `src/special/polylogarithm.js` — `if (n === 1) return -Math.log(1 - z)` — bypassing Wynn-epsilon entirely for the one order where it is both exact and provably worst under the general series.
- **The grid gap**: expanded `_polylogarithm_grid` in `scripts/precision-refs-special.py` to explicitly cover `n=2, 4, 5` in addition to `n=1, 3, 8`, each with its own measured, headroom-justified tolerance constant (`_TOL_POLYLOG_N{2,4,5}_{INTERIOR,NEAR_1}`).
- A related-but-worse instance of the same underlying mechanism — `riemannZeta`'s general branch degrading, and eventually becoming flatly wrong, for negative `s` — was deliberately left `WITHHELD` and filed separately as issue #1421, per #1414's own "fixing accuracy defects is out of scope" rule. It is not fixed here; kept distinct from the polylogarithm fix that *was* in scope because it lacks an equally simple closed-form bypass (the real fix likely needs the reflection functional equation, not a single added branch).

## Prevention Strategy

When designing a precision/reference grid for a function whose accuracy is known or suspected to vary continuously with a parameter, do not pick a small "representative sample" of that parameter's range by intuition. Instead:

1. First find every real caller of the function in the codebase (`grep` for the function name across `src/`) and make sure the grid includes their *exact* argument values — those are the values a regression would actually be user-visible at.
2. Only after covering real call sites, add further interior/boundary points to characterize the general convergence gradient (e.g. probing orders/arguments beyond what's currently called, for forward-compatibility).

This is a sharper, mechanism-specific corollary of the general precision-gate-generator-scrutiny principle in `solutions/testing/2026-07-29-0637-bessel-digamma-precision-gate-reference-generator-own-bugs.md`: that solution's concern was "does the grid exercise every code branch the production/reference logic has a special case for." Here the function has *no* code branches at all (`polylogarithm` was a single unconditional series before this fix) — the missing scrutiny was "does the grid cover every argument value real callers use" for a function whose only failure mode is a continuous quality gradient, which a sparse "representative" sample can miss entirely without ever tripping a branch-coverage check.

## Related Solutions

- `solutions/algorithm/2026-06-02-1130-wynn-epsilon-crz-replacement-and-signed-terms.md` — documents two specific Wynn-epsilon tableau-corruption bugs (near-zero denominator clamping, unset-estimate sentinel), but not the broader "extrapolation quality degrades — and can become flatly wrong — as the underlying series' terms decay more slowly" failure mode this build both hit (polylogarithm `n=1`, fixed here) and rediscovered in a more severe form (riemannZeta negative `s`, filed as #1421, unfixed). That solution's prevention strategy remains correct for the two bugs it names; this document does not supersede it, only extends the known failure-mode catalog for Wynn-epsilon-based functions in this codebase.
- `solutions/special-functions/2026-05-28-0000-besselISpherical-small-x-taylor.md` — the precedent pattern this build's polylogarithm fix directly instantiates: closed-form bypass for a degenerate regime rather than tolerance tuning.
- `solutions/testing/2026-07-29-0637-bessel-digamma-precision-gate-reference-generator-own-bugs.md` — related but distinct: that solution is about branch coverage in the reference generator itself; this one is about parameter coverage matching real callers for a branchless, continuously-degrading function.

## Key Insight

For a series-acceleration function whose accuracy degrades continuously with a discrete parameter, a precision grid must include the exact parameter values real callers use — not a sparse "representative" sample — because the accuracy gap at the skipped values is invisible until something, production code or a reviewer, actually exercises them.
