# ADR-0039: Reparametrizing Subclasses of Non-Trivial Parents Use a Cached Delegate Instance

**Date**: 2026-07-22
**Status**: Accepted

## Context

ADR-0018 (`decisions/0018-continuous-subclass-natural-params.md`) established the fix for
reparametrizing `Distribution` subclasses that leak a parent's transformed/dummy parameters into
`.params()`: replace `this.p` with only the subclass's own natural parameters, move any
parent-derived value still needed into `this.c` via `Object.assign(this.c, {...})`, and
re-implement any method that used to delegate to `super._xxx()` (which read the parent's `this.p`
directly) to call the underlying algorithm/special function directly using the value now in
`this.c`. This "call the function directly" strategy (ADR-0018's Option A) works cleanly when the
parent's `_pdf`/`_cdf`/`_generator` are short expressions wrapping a single special-function call
— confirmed in practice for `R`, `PERT`, `BirnbaumSaunders` (issue #1057) and, in this PR, `F`,
`BaldingNichols`, `Weibull`, `GeneralizedGamma` (issue #1070).

Issue #1070 also covers three subclasses whose immediate parent's `_pdf`/`_cdf`/`_generator` are
NOT short expressions: `NoncentralF` (parent `NoncentralBeta`), `DoublyNoncentralF` (parent
`DoublyNoncentralBeta`), and `DoublyNoncentralChi2` (parent `NoncentralChi2`). Each parent
implements a 30-80 line algorithm — recursive Poisson-mixing series (`recursiveSum`), Bessel
function branches, or (for `DoublyNoncentralBeta`) six private helper methods — all reading the
parent's own `this.p.*` directly, several levels deep inside closures.

Two options were evaluated for these three files:

1. **Rewrite the parent classes** (`NoncentralBeta`, `DoublyNoncentralBeta`, `NoncentralChi2`)
   to store their own parameters in `this.c` as well as `this.p`, and change every internal method
   to read `this.c.*` instead of `this.p.*`. Rejected: these three parents are independently
   exported, user-facing distributions (`ran.dist.NoncentralBeta` etc.) outside this issue's
   stated scope. Modifying them risks regressing a working, separately-tested public API for a
   bug they do not have, violates this repo's one-concern-per-issue and decomposition discipline,
   and requires ~50 mechanical-but-error-prone substitutions inside dense numerical series code.
2. **Duplicate the parent's algorithm inline**, textually replacing `this.p.X` with `this.c.X`
   throughout a copy of the parent's method bodies. Rejected: this duplicates ~50-240 lines of
   non-trivial series-summation math per file (worst case: `DoublyNoncentralBeta`'s six private
   helpers), with no precedent for that scale of duplication anywhere in this codebase, and creates
   a synchronization burden if the parent's algorithm is later corrected or tuned.

## Decision

When a reparametrizing subclass's immediate parent implements a non-trivial `_pdf`/`_cdf` (not a
one-line special-function wrapper), the subclass constructs and caches an instance of the parent
class, parameterized with the same transformed values previously passed to `super(...)`, and
delegates its own `_pdf`/`_cdf` to that cached instance's `_pdf`/`_cdf`. Concretely:

1. The subclass calls `super(...)` as before (with transformed parent-space parameters), then
   replaces `this.p` with only its own natural parameters (per ADR-0018).
2. It constructs a delegate — a real instance of the parent class built from the same
   parent-space parameters — and stores it as a plain instance field (e.g. `this.ncBeta`,
   `this.dncBeta`, `this.ncChi2`), following the existing convention for derived-state fields
   (`this.aliasTable` in `Categorical`/`HyperExponential`, `this.pdfTable` in `_pre-computed.js`) —
   no `_` prefix, since it is exposed instance state, not a method.
3. `_pdf(x)`/`_cdf(x)` call the delegate's `_pdf`/`_cdf` directly (e.g.
   `this.ncBeta._pdf(transformedX)`) instead of `super._pdf()`/`super._cdf()`. This is safe and
   numerically identical to the pre-fix behavior because the delegate is a correctly-parameterized
   instance of the exact same class `super()` would have configured.
4. `_generator()` is **not** delegated to the cached instance — each `Distribution` instance owns
   its own PRNG (`this.r = new Xoshiro128p()`, `_distribution.js:39`), so a cached delegate has an
   independent, differently-seeded stream. Instead, `_generator()` is re-implemented to call the
   same low-level stateless sampler functions the parent's `_generator` calls (e.g.
   `noncentralChi2(this.r, ...)`, `chi2(this.r, ...)`), using the subclass's own `this.r`. This
   mirrors the existing precedent in `doubly-noncentral-beta.js`, whose `_pdf`/`_cdf` already
   construct fresh sibling instances for the λ=0 degenerate collapse (deterministic case only,
   never for `_generator`).
5. Because the delegate is not serializable, the subclass adds an `_afterLoad()` override (the
   existing hook, `_distribution.js:787`, called by `Distribution.load()` after `this.p`/`this.c`/
   `this.r` are restored) that reconstructs the delegate from the now-restored `this.p`.

## Consequences

- Zero changes to the three parent classes (`NoncentralBeta`, `DoublyNoncentralBeta`,
  `NoncentralChi2`); they remain untouched, correctly-tested, independent public distributions.
- The parent's algorithm continues to live in exactly one place — the delegate simply invokes it —
  so future numerical corrections to the parent propagate automatically to every subclass that
  delegates to it, with no synchronization step.
- Each affected instance carries one extra cached object (the delegate), a bounded, fixed memory
  cost, never recomputed after construction.
- `save()`/`load()` round-trips correctly via `_afterLoad()`, matching the existing pattern used by
  `Categorical`, `HyperExponential`, and `PreComputed`.
- This decision extends ADR-0018's option set with a fourth, more specific strategy: ADR-0018 did
  not distinguish between one-line and non-trivial parent methods; this ADR resolves that gap for
  future reparametrizing subclasses of algorithmically complex parents.
