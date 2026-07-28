---
date: 2026-07-28T08:33:14Z
category: "special-functions"
problem: "marcumQ's _zetaxy() catastrophically cancels (NaN, or a silently-wrong plateau) when ys=y/mu is far below 1, breaking Rice/NoncentralChi/NoncentralChi2's .cdf() and .q() for every probability"
status: complete
related_issue: "#1179"
related_plan: "thoughts/plans/2026-07-27-1900-marcum-q-zetaxy-small-y-cancellation.md"
tags: [marcum-q, catastrophic-cancellation, zetaxy, rice, noncentral-chi, noncentral-chi2, nan-comparison-guard, regime-dispatch]
---

# Solution: marcumQ `_zetaxy()` catastrophic cancellation for `ys ≪ 1`

**Date**: 2026-07-28T08:33:14Z
**Category**: special-functions
**Related Issue**: #1179

## Problem

`marcumQ`/`marcumP`'s quadrature fallback (`_pqTrap`) produced `NaN` — and, per the issue body, a silently-wrong constant plateau (~1/e) under a naive first-attempt patch — whenever the scaled argument `ys = y/mu` was many orders of magnitude below 1 while `xs` stayed `O(1)`–`O(10)`. This broke `Rice.cdf()`, `NoncentralChi.cdf()`/`.q()`, and `NoncentralChi2.cdf()`/`.q()`.

The `.q(p)` breakage was total, not partial: since none of the three distributions override `_q(p)`, the base class's `_qEstimateRoot` always probes `cdf(Number.EPSILON)` as its initial bracket point regardless of the requested `p` (`src/dist/_distribution.js`'s `_qInitialGuess`/`_qEstimateRoot`), landing `y` at `~1e-32` (Rice/NoncentralChi, which square the CDF argument) or `~1e-16` (NoncentralChi2) for *every single quantile call*.

The precision-gate script (`scripts/precision-refs-continuous.py:1428-1435`) had already been forced to withhold `NoncentralChi[5,8]` and `Rice[8,1]` from `test/precision-continuous.js` because of this exact bug, with an inline comment explicitly saying the fix was "filed separately" — this issue is that separate filing.

## Root Cause

`_zetaxy(xs, ys)` computes the saddle-point variable via a reformulation (`eps^2/d1 + 2*eps^2/(d1*d2) + log1pmx(2*eps/d2)`, `d2 = w + 2*ys - 1`, `w = sqrt(1+4*xs*ys)`) that was deliberately assembled — per the prior fix for issue #253 — so every term is `O(eps^2)`, avoiding cancellation **only near the transition line `ys = xs + 1`** (`eps = xs - ys + 1 ≈ 0`). That reformulation was never designed for, and provides no protection against, the opposite regime: `ys` far below 1. There, `w` rounds to exactly `1.0` once `4*xs*ys` underflows the ULP of 1, collapsing `d2` to exactly `0`, which feeds a zero denominator into `2*eps^2/(d1*d2)` (→ `Infinity`) and `log1pmx(...)` (→ `NaN`).

That `NaN` then defeated a downstream underflow guard in `_pqTrap` (`if (-halfMuZeta2 < Math.log(DELTA))`) and, separately but structurally identically, the base class's `_qEstimateRoot` bracket-search guard (`if (fa * fb >= 0) return NaN`) — both guards are silently defeated because JS `NaN` comparisons always evaluate `false`, so a value meant to trigger a safe short-circuit instead falls through into further NaN-producing computation.

## Fix

Added a second branch to `_zetaxy`, gated on `u = 4*xs*ys < 0.5`. Using the *exact* algebraic identity `d1 - eps = d2`, the two large, near-cancelling terms `2*eps^2/(d1*d2) + log1pmx(2*eps/d2)` are folded — algebraically, not approximately — into `-2*eps/d1 + log1p(2*eps/d2)` before either subexpression is evaluated, and `d2` is separately rationalized as `u/(w+1) + 2*ys` to avoid the `w - 1` subtraction. This is the same quantity computed via a better-conditioned but exactly equivalent path, not a new asymptotic approximation. The `u >= 0.5` branch is untouched, preserving prior (#253) behavior byte-for-byte.

The identity was independently hand-verified four times during this session (the planning orchestrator, the `review-correctness` agent, the `review-impact` agent, and `ops-triage`) before being trusted — each re-derived it from scratch rather than checking the others' work.

Two alternatives were explicitly considered and rejected during planning:
- **Dispatch small-`y` inputs to the existing `_series()` branch instead.** Rejected because `_series`'s Newton truncation-index solve was only ever validated for `x < 30`, and this would silently extrapolate it to `x ≫ 30` untested, while leaving `_zetaxy` itself broken as a latent hazard for any future caller or dispatch-boundary change.
- **A hybrid of both.** Rejected as strictly worse — two overlapping guards for one bug, with real risk that a future refactor removes one without realizing the other covers a different sub-regime.

## Prevention Strategy

When a regime-switched special function is patched for cancellation in one identified regime, explicitly ask whether the fix's protection is one-dimensional (valid only near the specific point/line it was derived for) or covers the function's full input domain. For `_zetaxy`, the #253 fix protected only the neighborhood of `eps ≈ 0` (`ys ≈ xs+1`); it did nothing for `ys ≪ 1` because that's a structurally different axis of the same two-variable function.

Concretely:
1. When writing a cancellation-avoidance JSDoc/comment, name the exact regime it covers ("near `ys=xs+1`") rather than the function in general, so future readers don't assume blanket coverage.
2. For a function of two scaled variables, reason about all extreme corners of the domain (`xs→0`, `ys→0`, `xs→∞`, `ys→∞`, and the transition boundary) independently, not just the corner that motivated the original fix.
3. Treat `w = sqrt(1 + small)` rounding to exactly `1.0` (and any `w - 1` subtraction downstream) as a specific, recurring red flag in this codebase's special functions — rationalize such subtractions via the algebraic identity (`w-1 = u/(w+1)`) before they're ever computed directly.
4. Never let a NaN-defeats-comparison-guard mechanism (`if (x < threshold)` where `x` may be `NaN`) stand as the only safety net — this bug crossed two independent instances of that exact JS footgun (`_pqTrap`'s underflow guard and `_qEstimateRoot`'s bracket guard) and both failed the same way. `_qEstimateRoot`'s hardening was deliberately left out of scope here (see issue #1179's Out-of-Scope note) and remains a candidate follow-up.

## Related Solutions

- `solutions/special-functions/2026-05-21-0724-marcum-q-four-branches.md` (#253) — the prior, related fix to this same function, covering the `ys=xs+1` transition-line regime. This solution is the second cancellation fix to `_zetaxy` specifically; the recurrence — a single numerical formula having multiple independent cancellation-prone regimes fixed one at a time as they're discovered — is itself worth noting for a special-function-heavy library like this one, given how many functions in `src/special/` use threshold-gated regime dispatch (`_log1pmx`, `erf`/`erfc`/`erfcx`, `e1`, `hypergeometric`).
- `solutions/special-functions/2026-05-21-1604-marcum-large-mu-asymptotic.md` (#315) — a structurally similar lesson: a paper's printed coefficients/regime coverage can be insufficient at the exact boundary a dispatcher routes through.

## Key Insight

A cancellation fix for one regime of a multi-variable special function provides zero protection for a different, independent cancellation-prone regime of the same function — always identify and state the exact domain a numerical reformulation covers, and check the function's other extreme corners, rather than assuming "we already fixed the cancellation in this function."
