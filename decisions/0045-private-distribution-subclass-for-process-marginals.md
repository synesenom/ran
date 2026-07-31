# ADR-0045: Private Distribution Subclass for Process Marginals Without a Public Equivalent

**Date**: 2026-07-31
**Status**: Accepted

## Context

ADR-0040 established that `Process.marginal(t)` returns an existing `ran.dist` `Distribution`
instance built from parameters the process's own `mean()`/`variance()`/`pdf()` already derive, so
`quantile()`/`hazard()`/`survival()`/`likelihood()`/`aic()`/`bic()`/`test()` are inherited for free
with no new numerical machinery. All five processes ADR-0040 covered (`BrownianMotion`,
`OrnsteinUhlenbeck`, `BrownianBridge`, `GeometricBrownianMotion`, `CoxIngersollRoss`) have marginals
that are already-named public `ran.dist` classes (`Normal`, `LogNormal`, `Gamma`).

`RandomWalk`'s marginal (`X_t = 2K - t` for `K ~ Binomial(t, p)`) is not: it is an affine transform
of `Binomial`'s support, and no `ran.dist` class represents that shape. ADR-0040 (lines 43-45)
explicitly left `RandomWalk` (along with `AR1`, `PoissonProcess`, `CompoundPoissonProcess`) on
`Process`'s throwing `marginal()` default "for now."

Two options existed: (a) make the affine-transformed Binomial a fully public
`ran.dist.ShiftedBinomial`, subject to the complete "Adding a New Distribution" checklist in
`CLAUDE.md` (mpmath-derived precision gate, `dist-cases-discrete.js` entry, fit test, subpath
export, README count, CHANGELOG entry); or (b) a private, non-exported `Distribution` subclass
used only as `RandomWalk.marginal()`'s return value. Precedent already exists for single-consumer
private `ran.dist` files (`_sign.js` is used only by `student-t.js`; `_guess-meta.js` is used only
by `guess.js`). Separately, the issue's own acceptance criteria for the returned instance's API
surface (`pdf`/`pmf`, `cdf`, `quantile`, `hazard`, `survival`, `likelihood`, `aic`, `bic`, `test`)
notably omits `fit()` — the one method the full-checklist route exists mainly to guarantee works
for every caller.

## Decision

When a process's marginal distribution has no existing public `ran.dist` equivalent, and is not
otherwise a generally useful named distribution in its own right, `marginal()` may return an
instance of a private, non-exported `Distribution` subclass living in `src/dist/` (leading-
underscore filename, e.g. `_shifted-binomial.js`), rather than triggering the full "Adding a New
Distribution" checklist. Such a class:

- still extends `Distribution` directly and implements whatever protected hooks are needed to
  satisfy the `Distribution` API surface actually promised by `Process.marginal()`'s contract
  (`pdf`/`pmf`, `cdf`, `quantile`, `hazard`, `survival`, `likelihood`, `aic`, `bic`, `test`);
- is exempt from `static _fitInit`, since `fit()` is not part of that promised surface and the
  class has no public constructor path a caller could reach to invoke it on;
- is exempt from `test/dist-cases-*.js`, the mpmath precision gate, `package.json` subpath export,
  README's distribution count, and its own CHANGELOG bullet — those exist to support user-
  constructible distributions;
- is still tested for correctness, but through the consuming process's own `.marginal()` test
  block (matching the existing pattern for `BrownianMotion`/`OrnsteinUhlenbeck`/etc. in
  `test/process.js`), not a standalone `dist-cases` entry.

`RandomWalk.marginal(t)` is the first user of this pattern, returning an instance of
`ShiftedBinomial` from `src/dist/_shifted-binomial.js`.

## Consequences

**Easier:**
- A process whose marginal has no natural public-distribution name (an affine transform, a
  reparametrization) can still satisfy ADR-0040's full-API promise without inflating the public
  `ran.dist` surface with single-purpose classes nobody constructs directly.
- Future processes in the same situation (e.g. a future discrete-time walk with a transformed
  marginal) have a concrete precedent to follow instead of re-litigating public-vs-private each
  time.

**Harder:**
- Two categories of underscore-prefixed `Distribution` subclass now exist for different reasons:
  `_pre-computed.js`-style abstract bases meant to be subclassed further, and this new category of
  "complete, private, single-purpose" classes. Contributors must check which category a given
  `_`-prefixed file falls into before assuming it needs the full checklist.
- If a private marginal class's affine-transform math or special-case handling ever needs to
  change, there is no `dist-cases` regression to catch a mistake — coverage relies entirely on the
  consuming process's test block staying thorough.
