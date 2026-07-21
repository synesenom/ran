---
date: 2026-07-20T23:59:27Z
category: "distribution"
problem: "guess() needs a candidate distribution's type/k/support before the expensive fit() call, but Distribution exposes none of these statically"
status: complete
related_issue: "#813"
related_plan: "thoughts/plans/2026-07-20-2009-guess-distribution-ranking.md"
tags: [distribution, guess, fit, fitInit, introspection, static-accessor, cross-cutting-change]
---

# Solution: Reusing `_fitInit()` to build a disposable probe instance for pre-fit introspection

**Date**: 2026-07-20T23:59:27Z
**Category**: distribution
**Related Issue**: #813

## Problem

`ran.dist.guess(data, options)` needs to read a candidate distribution's `type()` (continuous/discrete), `k` (parameter count), and `support()` bounds *before* deciding whether it's even worth running the expensive `Cls.fit(data)` (Powell optimization) call — pre-filtering incompatible candidates is mandatory, not optional, since `Distribution.fit()`'s Powell objective silently maps any thrown construction error to `Infinity` rather than propagating (per `decisions/0016-distribution-fit-powell-and-exact-mle.md`), so a garbage fit on out-of-support data would otherwise return silently instead of erroring.

But `Distribution` exposes none of `type`/`k`/`support` as true static (class-level, no-instantiation) properties — `type()`/`k`/`support()` are only readable on an already-constructed instance, and constructing one normally requires already knowing valid parameter values, which is exactly what `guess()` doesn't have for an arbitrary candidate class ahead of time.

## Root Cause

No static accessor for `type`/`k`/`support` was ever added to the ~145-file `Distribution` hierarchy because nothing needed cross-candidate introspection before this feature — every prior caller of `Distribution` already knew which concrete class (and valid parameters) it wanted before ever touching `type()`/`k`/`support()`.

## Fix

Rather than adding a new static accessor to the base class and retrofitting all ~145 subclasses (a large cross-cutting change, and still fragile since a static accessor duplicating instance-derived values could itself drift from the constructor — see the companion solution on `BetaRectangular`'s inherited-`k` bug for exactly this kind of drift), `guess()` reuses `Distribution.fit()`'s own existing internal first step: `Cls._fitInit(data)` is mandatory on every distribution (per CLAUDE.md's "Adding a New Distribution" checklist) and returns a data-derived, constraint-satisfying parameter vector. `new Cls(...Cls._fitInit(data))` builds a cheap throwaway "probe" instance purely for introspection (`probe.type()`, `probe.k`, `probe.support()`), wrapped in `try/catch` so a candidate whose `_fitInit` misbehaves is skipped rather than crashing `guess()`.

`_fitInit` then runs a second time inside the later `Cls.fit(data)` call for surviving candidates — an accepted, deliberate redundancy since `_fitInit` implementations are O(n) moment/closed-form calculations, negligible next to the Powell optimization that actually dominates `fit()`'s cost. This tradeoff was explicitly reasoned through via a design-propose/design-critique pass before implementation (see the plan's Design Decisions §3) rather than assumed.

## Prevention Strategy

When a new feature needs class-level introspection across an entire family of subclasses that only expose the needed data as instance state, first check whether an existing **mandatory protected hook** (here, `_fitInit`) can be reused to manufacture a cheap throwaway instance, before proposing a new static accessor or base-class API surface. The latter is a much larger, harder-to-revert cross-cutting change (touching every subclass, per CLAUDE.md's "Decomposing Cross-Cutting Changes" guidance) for something a single already-existing per-subclass hook can already provide "for free." This generalizes beyond `guess()`: any future feature needing to compare/filter/rank across the distribution catalog before committing to a specific candidate should look for the same pattern.

## Related Solutions

- `decisions/0016-distribution-fit-powell-and-exact-mle.md` — documents why `fit()`'s Powell path can't be trusted to signal a bad candidate, motivating the pre-filtering this pattern supports.
- `solutions/correctness/2026-07-20-2359-beta-rectangular-inherited-k-bic-bias.md` — a concrete instance of the "static accessor could drift from the constructor" risk this fix deliberately avoided by not adding one.

## Key Insight

When a `Distribution`-family feature needs pre-instantiation introspection (type/k/support) across the whole catalog, reuse `_fitInit`'s mandatory-per-subclass, data-derived parameter vector to build a disposable probe instance rather than adding a new static accessor to the base class and every subclass.
