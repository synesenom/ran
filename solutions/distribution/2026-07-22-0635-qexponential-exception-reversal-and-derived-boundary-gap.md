---
date: 2026-07-22T06:35:07Z
category: "distribution"
problem: "QExponential's documented, intentional this.p exception was reversed once ADR-0018's this.c-relocation pattern made the original blocker obsolete, surfacing a second latent moment-method bug and a derived-parameter IEEE-754 boundary gap along the way"
status: complete
related_issue: "#1058"
related_plan: "thoughts/plans/2026-07-21-1930-qexponential-natural-params.md"
tags: [this.p, this.c, params, reparametrization, ADR-0018, qexponential, generalized-pareto, ieee754, floating-point, boundary-testing, moments, over-conservative-override, NaN, Infinity]
---

# Solution: QExponential exception reversal, moment-method drift, and a derived-boundary gap

**Date**: 2026-07-22T06:35:07Z
**Category**: distribution
**Related Issue**: #1058

## Problem

`QExponential extends GeneralizedPareto`, reparametrizing GP's `(mu, sigma, xi)` as
`(q, lambda)`. Its constructor never overwrote `this.p` after `super()`, so `.params()`
leaked GP's canonical `{mu, sigma, xi}` instead of the constructor's own `{q, lambda}` —
violating the codebase-wide "natural params only" contract (ADR-0009/0014/0018). This
was not an oversight: it was a documented, deliberate exception recorded in
`solutions/distribution/2026-06-09-1400-qexponential-parent-params-and-ieee754-boundaries.md`,
carved out because naively rewriting the moment methods against `this.p.q`/`this.p.lambda`
would silently return `NaN` (those keys never existed on `this.p`).

Reversing the exception surfaced a second, independent, previously-undetected bug:
`QExponential.skewness()`/`.kurtosis()` used a two-tier `formula | Infinity` split on
`xi`, while `GeneralizedPareto`'s own `skewness()`/`kurtosis()` — using the identical
`xi` and identical formulas — used a three-tier `formula | Infinity | NaN` split (`NaN`
for `xi >= 0.5`, where the variance itself is infinite, making the standardized
skewness/kurtosis ratio an indeterminate `∞/∞`). `QExponential` had been silently
returning the wrong sentinel in that range since the distribution was first written.

## Root Cause

**The exception was solving a real problem with a solution that later became
obsolete.** The 2026-06-09 fix correctly diagnosed that moment methods reading
nonexistent `this.p.q`/`.lambda` keys would break, but it conflated *where the
transformed values live* with *what `.params()` should expose*. By the time issue
#1058 was filed, the actual general-purpose fix for that exact problem — ADR-0018's
`this.c`-relocation pattern — had already been applied to 17 other distributions
(9 under the original rollout, 8 more under issue #1057). Nobody had revisited whether
the QExponential exception was still necessary once that infrastructure existed
elsewhere; it had ossified into "permanent" by default rather than by re-evaluation.

**The skewness/kurtosis divergence went undetected because nobody diffed the subclass's
moment-method *branch structure* against the parent's.** `QExponential`'s moment methods
were written as standalone formulas over `xi`, not derived from or checked against
`GeneralizedPareto.prototype`'s own moment methods for the same `xi`. Numeric spot-checks
at a handful of sample `xi` values never happened to land in the `xi >= 0.5` range where
the two-tier/three-tier split actually differs.

## Fix

Applied ADR-0018's established mechanical pattern, with three technique refinements
worth keeping as reusable lessons beyond "did ADR-0018 again":

**1. Capture-before-overwrite, not recompute.** Right after `super()` runs (which sets
`this.p = {mu, sigma, xi}` inside `GeneralizedPareto`'s own constructor), the fix does:
```js
const { mu, sigma, xi } = this.p   // captured from the parent's own computation
this.p = { q, lambda }
Object.assign(this.c, { mu, sigma, xi })
```
rather than recomputing `mu`/`sigma`/`xi` a second time from `q`/`lambda`. This
guarantees the values in `this.c` are bit-identical to what the parent constructor
actually computed — a single source of truth for the `(q, lambda) → (mu, sigma, xi)`
transform, and no risk of a copy-paste drift between the `super(...)` call's inline
expressions and a second hand-written copy of the same formulas.

**2. Bug discovery via parent/child moment-method diff.** The skewness/kurtosis bug was
caught not by a new test case but by directly comparing `QExponential`'s moment-method
*branch structure* against `GeneralizedPareto`'s own moment methods for the identical
`xi`. Since the formulas are supposed to be verbatim-identical (both operate on the same
`xi`), any structural divergence — a missing tier, a different threshold — is a bug by
definition, independent of whether any existing test happens to probe that range.

**3. Over-conservative-override anti-pattern.** The first implementation pass added a
`_generator()` override "for symmetry" with the `_pdf`/`_cdf`/`_q` overrides, with a
comment claiming the parent reads `this.p.mu/sigma/xi` directly. `/review`'s structure
pass caught that `GeneralizedPareto.prototype._generator()` only calls
`this._q(this.r.next())` — it never touches `this.p` itself. Since `_q()` was already
overridden to read `this.c`, the inherited `_generator()` already worked correctly via
normal polymorphic dispatch (`this._q(...)` resolves to the subclass's own `_q` at call
time). The override was dead code carrying a false justification comment. **Before
overriding a method "to be safe," trace what its only inherited implementation actually
delegates to** — if it only calls another method already overridden, re-overriding it
adds nothing.

**4. A second occurrence of the IEEE-754-derived-boundary-unreachable pattern.** The
original 2026-06-09 doc found `q=1.2`/`q=4/3` land *fractionally below* their
mathematical `xi` thresholds due to floating-point rounding in the `q → xi` conversion.
This session found a distinct variant: **no representable `q` maps to `xi = 0.5` at
all** — `q = 4/3` gives `xi = 0.49999999999999983`, and the *next representable double*
above it jumps straight to `xi = 0.5000000000000003`, skipping over exactly `0.5`.
Rather than write a fragile or misleading "boundary" test using a `q` that doesn't
actually land on the boundary, the fix documents the gap in a comment and points at
`GeneralizedPareto`'s own exact `xi = 0.5` test case (`test/dist-cases-continuous.js`)
as the boundary proof — since `QExponential`'s moment methods reuse GP's formula
verbatim, GP's own boundary test *is* the proof for both classes.

## Prevention Strategy

1. **Treat "documented, intentional exceptions" to a codebase-wide convention as
   provisional, not permanent.** When the convention's supporting infrastructure gets
   extended elsewhere to cover the original blocker (here, ADR-0018's `this.c`
   relocation pattern reaching 17 other distributions), revisit whether the exception
   is still load-bearing rather than leaving it standing on stale reasoning. A recurring
   audit ("does this exception's original justification still hold given what's been
   built since?") would have caught this sooner than a manually-filed issue.
2. **When a reparametrizing subclass's methods are meant to mirror a parent's formulas
   over the same derived variable, diff branch structure, not just sample outputs.**
   Numeric spot-checks at a few `xi` values won't catch a missing tier or a wrong
   threshold that only fires in a narrow input range (`xi >= 0.5` here).
3. **Before adding a defensive override, trace the inherited method's actual
   delegation chain.** If it only calls another method that's already overridden, the
   override is unnecessary — "probably touches `this.p`" is not a substitute for
   reading the parent's actual source.
4. **When a parameter is derived from a user-facing value via floating-point
   arithmetic and used in a `>=` divergence guard, don't assume every mathematical
   threshold is reachable from some input** — including the "next representable
   double" on either side. Some thresholds are skipped over entirely in IEEE-754.
   Verify with `console.log(value, value >= threshold)` before writing a boundary test;
   if the derived parameter can't reach it, fall back to testing the shared formula's
   exact boundary in whichever class owns the un-derived parameter directly.

## Related Solutions

- `solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md` —
  the original ADR-0018 rollout (9 distributions) whose `this.c`-relocation pattern
  this fix applies to `QExponential`.
- `solutions/distribution/2026-06-09-1400-qexponential-parent-params-and-ieee754-boundaries.md`
  — the decision this issue reverses; also the source of the "boundary values must be
  IEEE-754-exact" lesson that this session's finding #4 extends with a new variant
  (a threshold that's unreachable by *any* representable input, not just missed by a
  particular one).
- `solutions/distribution/2026-07-21-1252-reparametrizing-subclass-this-p-merge-vs-replace.md`
  — the most recent prior application of the same pattern (8 distributions, issue
  #1057), whose "Related Solutions" section explicitly flagged `QExponential` as the
  one remaining, deliberately-excluded exception — the exact gap this session closed.

## Key Insight

When reversing a "documented exception" to a codebase-wide convention, first check
whether the infrastructure that would have made the convention safe to apply already
exists elsewhere in the codebase — the original exception may have been solving a
problem that was later solved generically, making it obsolete rather than permanent;
and when copying a parent's formula into a subclass, diff the subclass method's branch
structure against the parent's own version for the same variable, since numeric
spot-checks won't catch a missing tier that only matters in a narrow range.
