---
date: 2026-08-01T16:00:00Z
category: "correctness"
problem: "AR1.marginal() carried a defensive variance <= 0 guard that no other process's marginal() has; it was unclear whether the non-stationary |phi| >= 1 branch could actually produce a non-positive variance, or whether the guard was unreachable dead code"
status: complete
related_issue: "#1244"
related_solution: "solutions/correctness/2026-08-01-1500-ar1-variance-cancellation-and-reformulation-boundary.md"
tags: [ar1, process, defensive-programming, dead-code, reachability-sweep, guard-removal, consistency]
---

# Solution: AR1.marginal()'s variance <= 0 guard was dead code left behind by a fixed bug

**Date**: 2026-08-01T16:00:00Z
**Category**: correctness
**Related Issue**: #1244

## Problem

`AR1.marginal(t)` carried a second guard beyond the usual `t <= 0` check:

```js
const v = this.variance(t)
if (v <= 0) {
  throw Error('AR1.marginal(): variance is not positive at t')
}
return new Normal(0, Math.sqrt(v))
```

None of the other nine `marginal()` implementations (`BrownianMotion`, `BrownianBridge`,
`OrnsteinUhlenbeck`, `CoxIngersollRoss`, `GeometricBrownianMotion`, `Poisson`, `PoissonProcess`,
`CompoundPoisson`, `RandomWalk`) has an equivalent check — they construct the target distribution
directly from `mean(t)`/`variance(t)` and rely on the target's own constructor validation to
reject a degenerate scale.

The open question was which of two things the guard was: (1) a legitimate protection against a
real `variance(t) <= 0` that the non-stationary `|phi| >= 1` branch can produce, deserving a WHY
comment, or (2) unreachable dead code that should be deleted to match the sibling pattern, per the
project's "no defensive checks for scenarios that can't happen" convention.

## Root Cause

The guard was reachable — **until issue #1243 was fixed**, and only because of that bug.

As recorded in
`solutions/correctness/2026-08-01-1500-ar1-variance-cancellation-and-reformulation-boundary.md`,
`AR1.variance(t)` used to suffer catastrophic cancellation in `1 - Math.pow(phi2, t)` for
near-unit-root `phi` combined with small fractional `t`, returning **exactly `0`** where the true
variance is small but strictly positive. That `0` flowed straight into this guard, so the guard
did fire in practice — but it fired on *valid* parameterizations, converting a silent precision
bug into a spurious `throw`. It never protected against a mathematically non-positive variance;
it masked an arithmetic defect in `variance()` itself.

Once #1243 replaced that expression with `-Math.expm1(t * Math.log(phi2))` and added the
`t === 0` fast path, the guard lost its only real-world trigger.

Structurally, `variance(t)` cannot return a negative value for `t > 0`:

- `|phi² - 1| < 1e-14` branch: returns `sigma² * t`, positive for `t > 0`.
- `phi² < 1`: `t·log(phi²) < 0`, so `-expm1(...) ∈ (0, 1]`, and the denominator `1 - phi² > 0`.
  Positive over positive.
- `phi² > 1`: `t·log(phi²) > 0`, so `-expm1(...) < 0`, and the denominator `1 - phi² < 0`.
  Negative over negative — the two sign flips cancel.

The non-stationary branch the issue suspected is in fact the one where the signs provably cancel;
its failure mode is divergence to `+Infinity` (which is the mathematically correct answer for an
explosive process, and passes `> 0` anyway), never a sign flip.

## Fix

A 29,700-combination sweep of `variance(t)` over the *actual* `src/process/ar1.js` module — `phi`
on a dense grid straddling the `1e-14` reformulation boundary plus a broad range through `phi²`
underflow and overflow, `sigma` from `Number.MIN_VALUE` to `1e300`, `t` from `Number.MIN_VALUE` to
`Infinity` — found:

- **0 strictly negative results.**
- 7160 exactly-zero results, *all* of them floating-point underflow: `t` below `~1e-322`, or
  `sigma` below `~1.6e-161` so that `sigma²` underflows to zero.
- 4320 `+Infinity` results, all on the explosive `|phi| > 1` branch (correct divergence).
- 1764 `NaN` results, all requiring a denormal `sigma` (so `sigma²` underflows to `0`) *together
  with* `t = Infinity`, giving `0 * Infinity` in the unit-root branch.

Restricted to a practical regime (`sigma ∈ [1e-3, 1e3]`, `t ∈ [1e-8, 1e6]`, no denormals or
infinities), 8232 combinations produced **zero** non-positive values; the only non-finite results
were the correct `+Infinity` divergences for `|phi| > 1` at large `t`.

So the guard is dead code for every input a caller could plausibly supply. It was removed, leaving
`marginal()` matching the sibling pattern exactly:

```js
marginal (t) {
  if (t <= 0) {
    throw Error('AR1.marginal(): t must be > 0')
  }
  return new Normal(this.mean(t), Math.sqrt(this.variance(t)))
}
```

Removal is behaviour-preserving where it matters: in the underflow cases that *do* reach `v === 0`,
`new Normal(0, Math.sqrt(0))` throws `Invalid parameters ... sigma > 0` from `Distribution.validate`.
The input is still rejected with an `Error`; only the message changes.

`pdf()`'s parallel `if (v <= 0) return NaN` guard was left in place — it predates #1156, uses a
different return channel (`NaN`, not `throw`), and changing it is explicitly out of scope for #1244.

### The bug the sweep turned up on the way

Establishing that #1243's fix had killed the guard's last trigger meant re-reading `variance()`'s
neighbours, which surfaced that `covariogram(s, t)` — three methods up in the same file — still
carried an independent copy of the *same* cancellation-prone expression:

```js
return Math.pow(phi, absLag) * sigma * sigma * (1 - Math.pow(phi2, minTime)) / (1 - phi2)
```

#1243 fixed `variance()` and never touched it. Because `Cov(X_t, X_t) = Var(X_t)` by definition,
the two methods contradicted each other outright in the near-unit-root regime: at
`phi2 = 1 - 2e-14`, `covariogram(1e-6, 1e-6)` returned exactly `0` while `variance(1e-6)` returned
the correct `~1e-6`, and `covariogram(0.01, 0.01)` was off by 11%. This was invisible to the test
suite because the existing `covariogram(t, t) === variance(t)` test used `phi = 0.5, t = 2`, far
outside the failing window — and `covariogram()`'s unit-root branch (`ar1.js:85`) was the file's
only uncovered line.

The same `-Math.expm1(minTime * Math.log(phi2))` reformulation was applied, plus the
`minTime === 0` fast path `variance()` already had at `t === 0`. That guard is not optional here:
`min(s, t) === 0` is an *ordinary* call (`covariogram(0, 5)`), not an exotic one, and without it
`0 * Math.log(phi2)` yields `NaN` whenever `phi2` underflows or overflows — precisely the boundary
regression the #1243 solution doc warned every future `expm1` rewrite to check for. Writing that
check as a red test first also exposed that the *pre-existing* code already returned `NaN` for
`covariogram(0, 3)` at `phi = 1e200` (`phi2` overflows to `Infinity`, and `Infinity * -0` is
`NaN`), a defect the reformulation would otherwise have silently inherited.

**The accuracy trade-off, stated plainly.** `-expm1(n·log(x))` amplifies `log`'s rounding error by
a factor of `n`, so the reformulation is *not* a free win everywhere. For a strongly explosive
process at large `min(s, t)` it is measurably worse than `Math.pow`: at `phi = 1.5, s = t = 200`,
relative error against an mpmath `mp.dps=60` reference moves from `3.4e-17` (old) to `9.6e-15`
(new). Over a 3800-point comparison in the well-conditioned regime, 3490 results were bit-identical
and the 1310 that differed were all within `1.9e-14`. Losing ~2 digits on a value that is already
`~1e70` and diverging, in exchange for eliminating a 100% error near the unit root, is the right
trade — and `variance()` has been making exactly this trade since #1243. A hybrid that switches on
`|minTime · log(phi2)|` would beat both, but it would have to be applied to `variance()` too, and
having the two methods on *different* formulations is what caused this bug in the first place.

## Prevention Strategy

**A guard that fires only because of a bug elsewhere is not a guard — it is a symptom.** The
`v <= 0` check appeared to be earning its keep precisely during the window when `variance()` was
broken, which is the most misleading possible evidence for keeping it: it was catching its own
dependency's arithmetic defect and re-reporting it as a domain error. When a defensive check is
observed to fire, the first question must be "is the *input* wrong, or is the *producer* of that
input wrong?" — because a guard that silently absorbs an upstream numerical bug actively delays
its diagnosis. Here, the spurious `throw` was strictly worse than an unguarded
`new Normal(0, 0)`, which would have surfaced the same problem with a message pointing at the
degenerate parameter.

**Prefer the callee's own validation over a duplicated pre-check.** Every other process's
`marginal()` delegates degenerate-scale rejection to the constructed distribution's constructor.
Duplicating that check upstream buys nothing (the constructor still validates) and costs
consistency: it makes one process look like it knows about a failure mode the others don't,
prompting exactly the kind of "is this load-bearing?" investigation that produced this document.

**A formula duplicated across sibling methods will be fixed in only one of them.** `variance()`
and `covariogram()` each held their own copy of the same geometric-series expression, so #1243's
cancellation fix landed in one and silently left the other broken — for a month, in a file that
had just been through a full review cycle. The structural tell was available for free: `Cov(t, t)`
must equal `Var(t)`, an identity the codebase already asserted for six other processes, but AR1's
version of that test used parameters (`phi = 0.5, t = 2`) nowhere near the regime the sibling fix
was about. **When fixing a numerical expression, grep the file for other instances of its shape
before closing the issue**, and when an identity ties two methods together, test it at the
parameters that are actually hard rather than at the convenient ones.

**Reachability claims about floating-point guards need a sweep, not an argument.** The structural
sign analysis above is sound but, on its own, would have missed the underflow-to-zero cases
entirely — `v <= 0` really is reachable, just not by the mechanism anyone hypothesized, and only
at denormal inputs. Sweeping the real module (not a re-typed copy of the formula) across
underflow, overflow, and boundary regimes is what turns "I believe this can't happen" into a
citable fact.

## Related Solutions

- `solutions/correctness/2026-08-01-1500-ar1-variance-cancellation-and-reformulation-boundary.md`
  — the cancellation fix that removed this guard's only real trigger. That document already noted
  in passing that the bad `0` "silently propagated into `pdf()`'s and `marginal()`'s existing
  `variance(t) <= 0` guards"; this document closes the loop by establishing that, with the
  cancellation gone, nothing else reaches them.
- `solutions/correctness/2026-08-01-1414-gbm-transition-density-asymmetric-domain-guard.md` —
  another `src/process/` guard-asymmetry finding from the same cycle, where the resolution went
  the *other* way (the guard was load-bearing and the asymmetry was the bug), which is why the
  reachability question here had to be settled empirically rather than by analogy.

## Key Insight

A defensive check that demonstrably fires in production is not thereby justified: it may be
catching a bug in the code that feeds it. `AR1.marginal()`'s `variance <= 0` guard fired only
during the window when `AR1.variance()` was returning a cancellation-induced `0`, and fixing that
upstream bug turned the guard into dead code for all non-denormal inputs — where it had, in the
meantime, been converting a silent precision defect into a confusing domain error.
