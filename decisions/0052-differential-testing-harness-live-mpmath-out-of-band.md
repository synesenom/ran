# ADR-0052: Differential-testing harness evaluates mpmath live and runs out-of-band from `npm test`

**Date**: 2026-08-09
**Status**: Accepted

## Context

`src/special/`'s existing precision gate (`scripts/precision-refs-special.py` → `test/precision-special.js`) commits a fixed, hand-curated set of `(fn, args) → ref` literals — a few hundred points, each hand-placed to straddle a documented internal dispatch threshold (e.g. `besselK`'s `_X_K_SERIES = 6` crossover). It runs under `npm test` on every push and is the library's CI-enforced correctness contract for these functions.

That grid is deliberately narrow: it proves the code is correct *at the specific points someone thought to check*, not across the interior of a branch or an unanticipated parameter combination. Issue #1264 asks for a complementary, much denser (10⁴–10⁵+ points per function), randomized sweep to catch defects a threshold-focused grid structurally cannot reach.

Committing that many reference literals is infeasible, and even if it were feasible, a frozen fixture cannot detect drift if a future mpmath version changes its own answer at any of those points — the fixture would silently stop meaning what it claims to mean. Evaluating mpmath live avoids both problems, but live mpmath evaluation of 10⁴+ points per function, across several functions, takes minutes and requires a Python + mpmath environment — neither belongs in the fast, always-green `npm test` gate that every contributor runs on every change.

## Decision

The new differential-testing harness (`scripts/difftest-special.py`, invoked via `npm run difftest:special`) evaluates mpmath **live** on every invocation instead of relying on any committed reference literal, and runs **entirely out-of-band from `npm test`** — it is not a mocha test, is not part of the `test` npm script, and is not wired into CI in this issue (scheduled CI is issue #1267).

It is a diagnostic/audit layer, not a merge-blocking gate. The committed `test/precision-*.js` files remain the sole CI-enforced correctness contract for `src/special/`; this harness supplements them with deeper, non-blocking coverage. `npm test`'s behavior and pass/fail semantics are unchanged by this harness's existence.

## Consequences

**Easier:**
- Catches interior-of-branch and unanticipated-parameter-combination defects invisible to a hand-picked grid — e.g. it can surface an accuracy cliff *between* two documented thresholds that nobody thought to probe directly.
- Adding sweep coverage for a new special function is a `SWEEP_SPEC` config entry (domain bounds, sample count, ULP ceiling), not new driver code or new committed literals.
- The report always reflects the reference math mpmath computes *today*, never a stale answer from whatever mpmath version happened to be installed when a fixture was generated.

**Harder:**
- No CI enforcement: a regression this harness would catch does not block a merge on its own. Closing that gap is explicitly deferred to the scheduled-CI follow-up (#1267); until then, catching a regression here requires a human to run it or a scheduled job to notice.
- Not byte-for-byte reproducible across an mpmath version bump without re-running — mitigated by a fixed default seed (for point selection) and by the report always naming the currently-installed mpmath version, so a difference in reported ULP error can be told apart from a difference in the reference itself.
- Requires a local Python + mpmath environment to run, same as the existing `precision-refs-*.py` scripts, unlike `npm test` which needs only Node.
