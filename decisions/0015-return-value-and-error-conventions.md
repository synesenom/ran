# ADR-0015: Return-value and error conventions (0 / NaN / Infinity / throw)

**Date**: 2026-05-31
**Status**: Accepted

## Context

The library signals "no ordinary result" inconsistently. A survey of the
codebase found four different channels in use with no written rule governing
which to pick:

- Constructors **throw** on invalid parameters (ADR-0004).
- `Distribution.q(p)` returns **`undefined`** for `p ∉ [0, 1]`.
- `pdf`/`cdf` return **`0`** outside the support.
- `_pre-computed.js` returns **`undefined`** when a sampler exhausts its tables.
- `core`, `special`, and `algorithms` have essentially no input guards — they
  rely on IEEE-754 to produce `NaN`/`Infinity` implicitly.

The trigger was the v1.29.0 theoretical-moments work (#403 and its
per-distribution follow-ups), which introduced `mean()`/`variance()`/
`skewness()`/`kurtosis()` returning `NaN` for undefined moments (Cauchy) and
`Infinity` for divergent ones (Lévy, Pareto with α ≤ 2). Reviewers asked
whether `NaN` was arbitrary and whether the whole library should instead
standardise on `undefined`, or alternatively always `throw`.

Returning `undefined` as a failure sentinel is actively harmful in this
codebase specifically:

- TypeScript declarations are **generated** from JSDoc (ADR-0010, ADR-0003).
  A numeric method that can return `undefined` is typed `number | undefined`,
  forcing null-checks across an otherwise purely numeric API.
- `JSON.stringify` **drops** `undefined`-valued keys and turns `undefined`
  array elements into `null`, corrupting any serialized moment vector or
  saved state.
- It is foreign to the numerical-computing idiom. `Math.sqrt(-1)` is `NaN`,
  `Math.log(0)` is `-Infinity`; SciPy returns `nan`, R returns `NaN`. #403
  explicitly models SciPy/R behaviour.

Collapsing everything to `throw` is equally wrong: wrapping hot numeric
kernels in exceptions for ordinary out-of-domain inputs is slow, breaks
vectorised use, and is not how `Math.*`/NumPy/SciPy behave.

The information distinction between `NaN` and `Infinity` is real and worth
preserving: an *indeterminate* moment (Cauchy mean) is `NaN` — no value
exists — whereas a *divergent* moment (Lévy mean) is `Infinity` — the value
grows without bound. Collapsing both to one sentinel discards information a
caller may legitimately branch on.

## Decision

Adopt a four-channel convention, applied across **all** modules (`dist`,
`core`, `special`, `algorithms`, `la`, …). The channel is chosen by the
*kind* of situation, never by convenience:

1. **`throw Error(...)`** — caller/programming errors: invalid or missing
   parameters, failed constraints, wrong arity, dimension mismatch,
   structurally impossible input (e.g. a negative count). Fail fast and loud.

2. **`NaN`** — a valid in-domain query whose answer is mathematically
   indeterminate / does not exist (mean of Cauchy, skewness of a point mass,
   `0/0`).

3. **`Infinity` / `-Infinity`** — a valid query whose answer diverges
   (variance of Pareto with α ≤ 2, every moment of Lévy). Never collapse
   divergence to `NaN`.

4. **`0`** — when the mathematically correct value is zero (pdf/cdf/pmf
   outside the support). Not an error.

`undefined` is **not** an error sentinel. It is permitted only for a
genuinely optional/absent value where the caller is expected to branch on
presence — never as a stand-in for `NaN`, `Infinity`, or a thrown error.

Hot numeric loops must not be wrapped in `throw`/`try` for ordinary
out-of-domain inputs; let the arithmetic yield `NaN`/`Infinity`.

This convention is documented user-facing in `README.md` and for
contributors in `CLAUDE.md`.

## Consequences

**Easier**:
- One rule covers every module; reviewers and contributors have an objective
  test for which channel to use.
- Generated `.d.ts` stay clean (`number`, not `number | undefined`).
- Behaviour matches SciPy/R, lowering surprise for users porting code.
- `NaN` vs `Infinity` preserves the indeterminate-vs-divergent distinction.

**Harder**:
- Existing deviations must be migrated. Known cases: `Distribution.q(p)` and
  `_pre-computed.js` return `undefined`; `core`/`special`/`algorithms` lack
  explicit input guards. These are filed as follow-up issues.

**Risk**:
- Changing `q(p)` from `undefined` to a thrown error (or to `NaN`) is a
  **breaking change** and must be routed to a major release (v2.0.0), not
  bundled with the additive v1.26.0 cleanups. Non-breaking guard additions
  (where the function currently produces a silently-wrong number) are not
  breaking and land in v1.26.0.
