# ADR-0038: Distribution.load() Validates Restored Shape via a Throwaway Probe Instance

**Date**: 2026-07-22
**Status**: Accepted

## Context

`Distribution.load(state)` (`src/dist/_distribution.js`) is a static factory that bypasses the
constructor (`decisions/0019-distribution-load-static-factory.md`) and assigns `this.p`,
`this.c`, `this.s`, `this.k` directly from a serialized `state` object with no validation. When
a distribution's `_pdf`/`_cdf`/`_generator`/`_q`/moment methods read a key off `this.c` that is
missing from the restored state — for example, an old snapshot serialized before the
distribution migrated its `this.p`/`this.c` shape under `decisions/0018-continuous-subclass-natural-params.md`
— those reads silently resolve to `undefined` and propagate to `NaN` instead of throwing
(issue #1074). `decisions/0015-return-value-and-error-conventions.md` requires a structurally
invalid input to throw `Error`, not silently degrade to `NaN`.

The fix must be a single base-class change in `load()` that works uniformly across all ~87
`Distribution` subclasses, with no per-distribution opt-in. That constraint rules out a
per-class declarative schema (`static get _stateSchema()` on every subclass) — the only
generic source of truth for a class's expected `this.p`/`this.c` keys is the code inside its
own (and its ancestors') constructor bodies.

ADR-0019 deliberately made `load()` skip the constructor specifically to avoid two costs: a
wasted constructor call, and spurious validation failures when a constructor guard tightened
after a snapshot was saved. A validation approach that embeds a key-set schema into `save()`'s
own output and checks a restored state against that self-embedded copy respects ADR-0019
exactly (no constructor call at all) — but it cannot catch the issue's own motivating scenario:
both the restored `state.params`/`state.constants` and the self-embedded schema were produced
by the *same* old `save()` call, so an old snapshot loaded under new code round-trips its
internal consistency check cleanly and still silently produces `NaN`. The self-referential
approach only detects corruption of states saved by the *current* code, not version skew
between the code that saved a state and the code that loads it — which is the actual failure
mode #1074 was filed to close.

## Decision

`load()` constructs a throwaway **probe instance** for the sole purpose of reading
`Object.keys(probe.p)` and `Object.keys(probe.c)` as the expected key sets for the *currently
running* class definition, then compares them against `Object.keys(state.params)`/
`Object.keys(state.constants)`. On any mismatch, `load()` throws a clear `Error` naming the
expected and actual keys. The probe is discarded immediately — it never becomes, or contributes
state to, the instance `load()` returns. That returned instance is still built exactly as
before: `Object.create(this.prototype)` plus direct field assignment, untouched by this change.

The probe's positional constructor args come from `Object.values(state.params)`, **padded with
`0` up to the constructor's declared arity** (`this.length`) when `state.params` has fewer
entries than the constructor expects. Padding, not skipping validation, was required to
correctly handle `Categorical` — verified (by instantiating every distribution in the codebase
from its test-case params and comparing `Object.keys(instance.p).length` against constructor
arity) to be the *only* distribution where `this.p` intentionally holds fewer keys than the
constructor declares (`this.p = { weights }` only; `min` is required by the constructor but
lives in `this.c`, per `decisions/0014-categorical-this-c-natural-params-split.md`). Padding is
safe because `this.p`/`this.c` are populated unconditionally by every constructor in the
codebase — never gated on a parameter's numeric value — so the pad value only has to satisfy
"defined and not NaN" for the probe to expose the correct key shape; its magnitude is
irrelevant to the resulting key set. Extra restored values beyond the constructor's arity are
safely ignored by JS's positional-argument semantics, so no corresponding truncation is needed
on the other side.

This narrows, rather than reverses, ADR-0019: the constructor is invoked purely as a read-only
side channel to answer "what shape does this class expect right now?", never to produce or
initialize the object handed back to the caller. If the probe constructor itself throws (e.g. a
constraint that has since tightened rejects the restored parameter values), `load()` surfaces
that as a clear validation error rather than deferring to a later silent `NaN` — consistent with
`decisions/0015-return-value-and-error-conventions.md`'s classification of structurally invalid
input as a caller/programming error.

`Object.values(state.params)` relies on the restored `this.p` having been populated in the same
key order the constructor's positional parameters expect, which holds for every current
subclass (each constructor sets `this.p` — directly or via `Object.assign` — in parameter
order). Distribution authors must preserve this ordering; it is not independently enforced.

## Consequences

**Easier:**
- Every subclass — including those that inherit `this.c` keys from a parent constructor without
  their own `Object.assign` call (`DoubleWeibull`, `HalfNormal`, `PowerLaw`) — is protected
  automatically: the probe runs the full constructor chain, so inherited keys are captured
  without any change to those subclasses.
- No per-distribution opt-in or schema maintenance burden; the fix lives entirely in
  `Distribution.load()`.
- `load()` now fails loudly and immediately on a structurally incompatible snapshot instead of
  deferring to a confusing downstream `NaN` from `pdf()`/`cdf()`/`sample()`.

**Harder:**
- `load()` now performs a real constructor call (with its own parameter validation, support
  computation, and PRNG allocation) on every invocation, which is strictly more work than the
  previous zero-validation path — acceptable given `load()` is not a hot loop, but a departure
  from ADR-0019's "no constructor call" framing.
- A restored snapshot whose values were valid at save time but now violate a *tightened*
  constructor guard (same key shape, stricter constraint) will also throw, even though its shape
  is unchanged. This is the risk ADR-0019 originally flagged; here it is accepted as consistent
  with `decisions/0015`'s throw-on-invalid-input convention rather than treated as a regression.
- `Object.values(state.params)` assumes constructor-positional-argument order matches `this.p`
  insertion order; a future distribution that reorders `this.p` relative to its constructor
  signature could produce a misleading probe.
