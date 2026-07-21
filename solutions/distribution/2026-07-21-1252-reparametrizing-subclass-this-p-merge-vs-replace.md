---
date: 2026-07-21T12:52:23Z
category: "distribution"
problem: "Reparametrizing Distribution subclasses leaked parent-class this.p keys into the public .params() method"
status: complete
related_issue: "#1057"
related_plan: "thoughts/plans/2026-07-21-1200-issue-1057-this-p-key-leaks.md"
tags: [this.p, this.c, params, reparametrization, super-delegation, ADR-0018, TypeScript-declarations]
---

# Solution: Fix `this.p` key leaks in reparametrizing Distribution subclasses

**Date**: 2026-07-21T12:52:23Z
**Category**: distribution
**Related Issue**: #1057

## Problem

Eight `ran.dist` classes that reparametrize a parent constructor (`PowerLaw`,
`R`, `Gilbrat`, `JohnsonSU`, `JohnsonSB`, `SkewNormal`, `BirnbaumSaunders`,
`PERT`) leaked the parent's internal `this.p` keys into the public
`.params()` method — e.g. `new R(4).params()` returned
`{ alpha: 2, beta: 2, c: 4 }` instead of `{ c: 4 }`, and `new Gilbrat().params()`
returned `{ mu: 0, sigma: 1 }` for a zero-parameter distribution.
`BirnbaumSaunders` had a compounding second bug: because its own natural
parameter is also named `mu` and collided with the leaked `Normal(0,1)`
placeholder key `mu`, the constructor stashed the real value under a
non-natural key `mu2`, so `.params().mu` always returned the wrong (leaked)
`0` regardless of what the caller supplied.

## Root Cause

Every affected constructor called `super(...)` (passing transformed or
dummy values to the parent), which set `this.p` to the *parent's* key
names, and then merged its own natural parameters in via
`this.p = Object.assign(this.p, {...})`. `Object.assign` merges into the
existing object rather than replacing it, so the parent's keys survived
alongside the subclass's own keys instead of being discarded. Two classes
(`PowerLaw`, `Gilbrat`) never touched `this.p` at all after `super(...)`,
so 100% of their exposed params were actually the parent's.

This is a structural gap in how `Distribution` subclasses reparametrize a
parent: the codebase already had the correct pattern (`this.p = {...}`
full replace) documented and applied to 9 other distributions under
ADR-0018, but 8 more distributions using the identical inheritance idiom
were missed in that original rollout — and the mandatory bug-triage pass
run during this session's own build found **9 more** unfixed instances of
the same pattern (`F`, `BaldingNichols`, `Weibull`, `NoncentralF`,
`DoublyNoncentralF`, `GeneralizedGamma`, `GeneralizedNormal`,
`DoublyNoncentralChi2`, `ExponentiatedWeibull`; filed as issue #1070). This
confirms it is a recurring idiom-level defect, not a one-off typo.

## Fix

Applied the already-proven ADR-0018 fix mechanically to all 8
distributions:
1. Replace `this.p = Object.assign(this.p, {...})` with `this.p = {...}`
   (full replace, natural constructor params only, in JSDoc `@param`
   order).
2. Move any parent-derived value still needed by a delegating method
   (`alpha`/`beta` for `Beta` subclasses, `mu`/`sigma` for `Normal`
   subclasses) into `this.c` via `Object.assign(this.c, {...})` — never a
   raw `this.c = {...}` reassignment, which would destroy the parent's own
   precomputed constants.
3. Rewrite every method that previously called
   `super._pdf()`/`super._cdf()`/`super._generator()`, since those parent
   methods read the now-removed `this.p.<parentKey>`:
   - If the parent method reads only `this.c` (e.g. `Beta.prototype._pdf`,
     which reads `this.c.{alphaM1,betaM1,lnBeta}`), the `super._pdf()`
     delegation is still safe and needs no change (`R._pdf`, `PERT._pdf`).
   - If the parent method reads `this.p` directly (e.g.
     `Normal.prototype._pdf`/`_cdf`/`_generator` reading
     `this.p.mu`/`this.p.sigma`), inline the same formula against the
     relocated `this.c` values or a hardcoded standard-normal constant
     (`JohnsonSU`, `JohnsonSB`, `SkewNormal`, `BirnbaumSaunders`).
   - If the subclass never overrode the parent's `_pdf`/`_cdf`/`_generator`/`_q`
     at all (`PowerLaw`, `Gilbrat`), add local overrides — in `PowerLaw`'s
     case this simplified to the distribution's own documented closed form
     (`f(x;a) = a·x^{a-1}`, the `b=1` specialization of Kumaraswamy).
   - Any moment method (`skewness`/`kurtosis`) inherited unmodified from
     the parent and reading `this.p.alpha`/`this.p.beta` (`R`, `PERT`, both
     via `Beta.prototype`) needs a local override reading `this.c.alpha`/
     `this.c.beta` instead.
4. `BirnbaumSaunders` additionally had every `this.p.mu2` read renamed to
   `this.p.mu` now that the key collision no longer exists.

A secondary fix was needed in `beta.js` and `kumaraswamy.js`: narrowing
`this.p`'s shape in a subclass (`R`/`PERT` narrowing `Beta`'s
`{alpha, beta}` down to `{c}`/`{a,b,c}`; `PowerLaw` narrowing
`Kumaraswamy`'s `{a, b}` down to `{a}`) broke TypeScript declaration
generation — `tsc --noEmit` failed with `Property 'p' in type X is not
assignable to the same property in base type Beta/Kumaraswamy`, because
`beta.js`/`kumaraswamy.js`'s `this.p` assignments lacked the
`/** @type {*} */` JSDoc annotation. `normal.js` already carries this
annotation (added under the prior ADR-0018 fix specifically to support
`HalfNormal`/`Slash` narrowing `this.p`'s shape), but `beta.js`/
`kumaraswamy.js` never needed it before since no prior subclass had
narrowed their `this.p` shape. Adding the same annotation to both files
resolved the typecheck failure with no runtime behavior change.

## Prevention Strategy

This is now a known recurring idiom-level defect (17 total occurrences
across two sessions, with 9 more still open in issue #1070). Any future
audit of `Distribution` subclasses that call `super(...)` with transformed
or dummy values should specifically grep for `this.p = Object.assign(this.p`
as a defect signal — the *replace-not-merge* fix is mechanical and
well-precedented by this solution and ADR-0018.

When designing a new `Distribution` base class whose `this.p` shape may
need narrowing in a reparametrizing subclass, add the `/** @type {*} */`
JSDoc annotation on the base's `this.p` assignment proactively (as
`normal.js` already does) rather than waiting for a `tsc` failure to force
it in later — this has now been a forced fix on two separate base classes
(`beta.js`, `kumaraswamy.js`) and will generalize to any other parent
class (e.g. `Weibull`, `GeneralizedGamma`) that later gains a narrowing
subclass under issue #1070.

## Related Solutions

- `solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md` — the original ADR-0018 rollout fixing this exact pattern for 9 distributions (`Chi2`, `Erlang`, `MaxwellBoltzmann`, `Rayleigh`, `DoubleWeibull`, `HalfNormal`, `Slash`, `LogCauchy`, `StudentZ`); this solution applies the identical technique to 8 more.
- `solutions/distribution/2026-06-09-1400-qexponential-parent-params-and-ieee754-boundaries.md` — documents the inverse, intentional exception (`QExponential` deliberately leaves `this.p` in the parent's `GeneralizedPareto` terms), explicitly out of scope for this fix.
- `decisions/0018-continuous-subclass-natural-params.md` — the governing ADR for the replace-not-merge pattern.

## Key Insight

Any `Distribution` subclass that calls `super(...)` with transformed or
dummy values must do `this.p = { naturalKeysOnly }` (full replace) — never
`Object.assign(this.p, {...})` (merge) — and must eliminate every internal
`super._pdf()`/`super._cdf()`/`super._generator()` call by relocating
parent-derived values into `this.c`, because the parent's prototype
methods read `this.p.<parentKey>` directly and will silently keep working
off stale/leaked data once the merge pattern is used instead of a replace.
