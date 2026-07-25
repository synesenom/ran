# ADR-0042: Return shape for single-sample goodness-of-fit tests in `ran.test`

**Date**: 2026-07-25
**Status**: Accepted

## Context

`src/test/` currently exports six functions (`bartlett`, `brownForsythe`, `hsic`, `levene`,
`mannWhitney`, `welch`), all **multi-sample comparison** tests. They uniformly return
`{stat, passed}` — no `pValue` field. Five of the six derive `passed` from a critical-value
comparison against an existing `ran.dist` distribution's `.q()`; only `welch` computes an actual
p-value internally (via `StudentT.cdf()`), but it discards that value rather than returning it.

Separately, `src/dist/_tests.js` holds two `@private` **single-sample goodness-of-fit** helpers,
`chi2` and `andersonDarling`, consumed only by `Distribution.prototype.test()`. Both return
`{statistics, passed, pValue}` — `pValue` was added deliberately (#1052, #1053) and is documented
in `CHANGELOG.md`.

Issue #1134 adds `cramerVonMises`, the first **single-sample GoF test to be exported publicly**
from `src/test/` (as opposed to living privately in `_tests.js`). Its acceptance criteria require
an asymptotic p-value to be implemented and verified against an external reference (scipy/R), which
means the p-value must be part of the public return value, not just an internal detail driving
`passed`. Sibling issues #1144 (Anderson-Darling) and #1138 (two-sample Kolmogorov-Smirnov) are
open and will add further GoF-style tests to the same namespace, so whatever shape `cramerVonMises`
adopts becomes the de facto precedent they are likely to follow.

Three shapes were considered: match the existing public `{stat, passed}` convention exactly
(dropping the p-value); adopt `_tests.js`'s private `{statistics, passed, pValue}` shape verbatim;
or a hybrid `{stat, passed, pValue}` that keeps the established public field name (`stat`) and adds
`pValue` as a new, additive field.

## Decision

New single-sample goodness-of-fit tests exported from `src/test/` return `{stat, passed, pValue}`.
This keeps the `stat` field name already established by all six existing public `src/test/*`
functions (rather than importing `_tests.js`'s private `statistics` naming into the public
namespace) and adds `pValue` as a new field wherever the underlying test computes one — additive to
the existing `{stat, passed}` shape, so any code destructuring `{stat, passed}` from a `ran.test.*`
result continues to work unchanged. `_tests.js`'s `{statistics, passed, pValue}` shape remains
correct for its own private, `Distribution.test()`-internal use and is not changed by this decision.

## Consequences

Future single-sample GoF tests added to `src/test/` (`andersonDarling` for #1144, the two-sample KS
test for #1138) should follow `{stat, passed, pValue}` rather than porting `_tests.js`'s
`{statistics, ...}` naming verbatim, giving the public `ran.test` namespace one consistent field
name for the statistic across all of its functions, single- or multi-sample. `welch` is not
retroactively changed by this ADR (it is a multi-sample test and already ships), but it has a clear,
low-risk upgrade path (add `pValue` to its existing return object) should a future issue choose to
take it. The public/private naming split between `ran.test.*` (`stat`) and `src/dist/_tests.js`
(`statistics`) persists as a known, accepted inconsistency rather than being unified, since
unifying would require either breaking `_tests.js`'s private internal callers or expanding this
ADR's scope beyond the single new test it was written to unblock.
