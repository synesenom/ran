---
date: 2026-07-30T17:47:27Z
category: "performance"
problem: "scripts/precision-refs-continuous.py's self_check() hung for 100+ minutes on DoublyNoncentralBeta's LARGE_LAMBDA_ANCHORS regression case, never completing and never reaching the remaining ~90 distributions"
status: complete
related_issue: "#1194"
related_plan: "thoughts/plans/2026-07-30-1608-dncbeta-self-check-hang.md"
tags: [doubly-noncentral-beta, precision-refs, self-check, incomplete-beta-recurrence, dev-tooling, mpmath]
---

# Solution: precision-refs-continuous.py's self_check() hang on DoublyNoncentralBeta — incremental incomplete-beta recurrence

**Date**: 2026-07-30T17:47:27Z
**Category**: performance
**Related Issue**: #1194

## Problem

`scripts/precision-refs-continuous.py`'s bare/`--check` self-check (`self_check()`; the two
invocations are behaviorally identical — the literal string `'--check'` is never actually
compared against `sys.argv` anywhere in the file) hung for 100+ minutes of CPU time once it
reached the `DoublyNoncentralBeta` entry, specifically the `LARGE_LAMBDA_ANCHORS` regression
case (`DoublyNoncentralBeta(2,2,1200,1200)` at `x ∈ {0.3, 0.5}`), never completing and never
reaching the remaining ~90 distributions the script covers. This made `self_check()` —
restored to actually running only days earlier under #1110, specifically to catch silent
premature-convergence regressions like #1108/#1086 — impractical for a full run, defeating its
purpose for any contributor following CLAUDE.md's documented `precision-refs-continuous.py`
workflow.

## Root Cause

`dncbeta_cdf(a, b, l1, l2, x)`'s nested double-Poisson-mixture summation calls mpmath's
regularized incomplete beta function (`Ireg`, wrapping `betainc`) once per `(r, si)` pair:

```python
term = exp(log_wr + log_ws) * Ireg(a + r, b + si, x)
```

At `lambda1 = lambda2 = 1200` (`h1 = h2 = 600`), the outer (`r`) and inner (`si`) loops together
visit roughly 800k-1M `(r, si)` pairs before satisfying the relative term-vs-running-sum
convergence check (the #1108/#1086 anti-regression fix, unchanged by this fix) — each pair
paying a fresh, expensive `mp.dps=50` `betainc()` evaluation. `dncbeta_pdf()`, by contrast, was
never the bottleneck (~30-41s per call): its per-term Beta-function value is already tracked via
an exact O(1) log recurrence (`logB(a, b+1) = logB(a, b) + log(b) - log(a+b)`, extended
similarly for the outer `a`-direction) rather than a fresh special-function call — the *same*
incremental-recurrence idiom this file already uses for its Poisson weights.

The initial hypothesis was that the walk's **starting position** was the problem: both loops
start at index 0 and cannot exit early before a fixed floor (`h1+5`/`h2+5` iterations), while
the true summand peak — per the file's own existing comment — can shift hundreds of steps away
from `(h1, h2)` as `x` moves from 0.5. This is true, but it is not the dominant cost driver.

## Fix

### Attempt 1 (implemented, measured, rejected): peak-relocated bidirectional walk

The JS implementation (`src/dist/doubly-noncentral-beta.js`) has a closed-form `_peakIndex`
estimator used to relocate its own series-summation walk when the standard window misses the
true peak (#1102). This was ported into Python (`dncbeta_peak_index`), and both `dncbeta_cdf`
and `dncbeta_pdf` were restructured to walk bidirectionally outward from the estimated peak
`(r_star, s_star)` instead of forward-only from `(0, 0)`, eliminating the fixed floor.

This was implemented, verified correct (0 mismatches across all four existing
`DoublyNoncentralBeta` REFS groups plus both `LARGE_LAMBDA_ANCHORS` values), and **measured**:
`cdf(0.3)` went from 1235s to 1001s, `cdf(0.5)` from 2659s to 2149s — only ~19% faster. Direct
instrumentation (counting `Ireg()` calls, and independently sampling `inner(r)` via a brute-force
per-`r` computation) showed why: the per-outer-step inner-walk cost (~700-750 `Ireg()` calls,
needed regardless of where the walk starts, to reach the required `1e-55` relative precision in
the `si` dimension at `h2=600` scale) dominates, and while relocation genuinely reduces the
number of outer (`r`) steps needed (peak-relocated backward convergence triggers around
`r ≈ 200-250` instead of needing the full `r=0`, versus forward convergence around `r ≈ 764`,
matching the original's own stopping point) — the total `(r, si)` grid visited shrinks by only
roughly 30%, and a ~15% per-call slowdown from the added bidirectional-walk bookkeeping largely
cancels even that. **Rejected**: this approach was abandoned (reverted via
`git checkout -- scripts/precision-refs-continuous.py`) once the real bottleneck was identified —
see Attempt 2.

### Attempt 2 (shipped): track `Ireg` itself via an incremental recurrence

The real fix targets the actual cost driver: `dncbeta_cdf`'s per-term `betainc()` call, not the
walk's starting position. The regularized incomplete beta function satisfies standard contiguous
relations (DLMF 8.17.20-style):

```
I_x(a, b+1) = I_x(a, b) + x^a (1-x)^b / (b B(a,b))      [b-direction, si loop]
I_x(a+1, b) = I_x(a, b) - x^a (1-x)^b / (a B(a,b))      [a-direction, r loop]
```

Both signs were independently re-derived from the standard recurrence and **numerically verified
to exact match (0 relative error)** against direct `betainc()` calls, at both toy scale (`a, b`
in 1-5) and production scale (`a, b` in the hundreds, matching `lambda=1200`), before any
implementation was touched. `dncbeta_cdf` now tracks a running `Ireg` value (`I_r0` at `si=0` for
the current `r`, refreshed to `I_val` at the start of each inner loop, exactly mirroring the
existing `logB_r0`/`logB` pattern `dncbeta_pdf` already used) via these O(1) recurrences, paying
for exactly **one** direct `betainc()` call for the entire function (`I_r0 = Ireg(a, b, x)` at
the very start) instead of one per `(r, si)` pair.

Critically, **the original forward-from-0 walk, its `h1+5`/`h2+5` floor, and its relative
term-vs-running-sum convergence check are entirely unchanged** — this is a pure per-term
evaluation optimization, not a restructuring of the summation or its convergence semantics.
`dncbeta_pdf` needed no changes at all (it never called `Ireg`).

Measured result: `DoublyNoncentralBeta(2,2,1200,1200).cdf(0.3)`: 1235s → 66.05s (~18.7x);
`.cdf(0.5)`: 2659s → 67.14s (~39.6x); both still correct to ~5.9e-15 relative error against the
frozen `LARGE_LAMBDA_ANCHORS` values (well inside the existing `5e-7` tolerance). All 17 existing
`DoublyNoncentralBeta` `cdf` reference values (three small-lambda REFS groups plus both
`LARGE_LAMBDA_ANCHORS` values) reproduce with 0 mismatches. End-to-end,
`python3 scripts/precision-refs-continuous.py --only DoublyNoncentralBeta` now completes in
`3m43s` with `0 mismatches`, down from 100+ minutes without completing.

No already-vetted reference value in `test/precision-continuous.js` or
`test/dist-cases-continuous.js` changed. `src/dist/doubly-noncentral-beta.js` and
`src/special/bessel.js` were not modified, per the issue's declared scope — `_peakIndex` was read
as reference material only (and, in the end, not needed).

### Rejected: bounded self-check timeout/skip

A third option considered during design (skip or timeout the `LARGE_LAMBDA_ANCHORS` case inside
`self_check()`, leaving `dncbeta_cdf`/`dncbeta_pdf` untouched) was rejected before implementation:
it would stop `self_check()` from actually exercising the exact case `LARGE_LAMBDA_ANCHORS` was
introduced to guard (#1108/#1086's premature-convergence bug class), directly violating the
issue's own acceptance criterion.

## Prevention Strategy

1. **Measure before declaring victory on a performance fix.** The peak-relocation attempt
   *looked* like the right fix (it directly addressed the documented "peak shifts away from
   the fixed floor" comment already in the file) and was fully implemented and verified
   *correct* before its performance was measured — only the actual wall-clock numbers revealed
   it fell far short of the target. Always measure the metric the issue actually cares about
   (here: wall-clock time) before considering a performance fix done, not just correctness.
2. **When a loop's total cost is `(steps) × (per-step cost)`, profile which factor actually
   dominates before optimizing either one in isolation.** Instrumented `Ireg()` call counts and
   a brute-force per-`r` cost breakdown (`diag4.py`/`diag5.py`/`diag6.py`-style ad hoc scripts,
   not committed) showed the per-step cost (~700 expensive `betainc()` calls per outer step) was
   the dominant term, not the step count — reducing step count alone (peak relocation) could
   never close more than a modest fraction of the gap.
3. **An abandoned optimization attempt from a related codebase (here, JS's own `#1102` fix,
   which tried and gave up on an incremental `Ireg` recurrence for its relocated walk due to "an
   unresolved sign error") is not proof the underlying idea is unsound** — it may only mean it
   wasn't verified rigorously enough at the time. This fix re-derived both recurrence directions
   from the standard contiguous relations and checked them to *exact* numerical match against
   `betainc()` at multiple scales, including the actual production scale, before trusting them —
   a stronger verification standard than "seemed to work on a few cases," which is plausibly what
   let the earlier sign error slip through undetected long enough to be abandoned.
4. **A recurrence relation's "forward" and "backward" directions are not mirror images of each
   other syntactically** — deriving each independently via substitution (not just negating the
   forward formula) and verifying both is necessary; this fix's `a`-direction and `b`-direction
   relations have different signs (`+` vs `-`) precisely because increasing the first vs. second
   shape parameter of a Beta distribution has opposite effects on where its CDF sits.

## Related Solutions

- `solutions/correctness/2026-07-23-1707-doubly-noncentral-beta-relocated-walk-and-issue-premise.md`
  (#1102) — source of the `_peakIndex` formula this fix's Attempt 1 ported (and ultimately did not
  need), and of the JS team's own abandoned incremental-`Ireg`-recurrence attempt this fix's
  Attempt 2 succeeded at, with a documented sign-error failure mode this fix's verification
  discipline was specifically designed to avoid repeating.
- `solutions/correctness/2026-07-23-1108-doubly-noncentral-beta-recursivesum-absolute-floor-truncation.md`
  (#1086) — origin of `dncbeta_cdf`/`dncbeta_pdf`'s existing incremental Poisson-weight/Beta-log
  recurrences and the term-vs-running-sum convergence check this fix leaves entirely unchanged.
- `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md` (#1110) — introduced
  `LARGE_LAMBDA_ANCHORS`, the exact regression anchor this fix's `self_check() --only
  DoublyNoncentralBeta` run (3m43s, 0 mismatches) now exercises in practical time.
- `solutions/tooling/2026-07-26-2200-precision-refs-only-flag-cache-scope-not-compute-scope.md`
  (#1149) — the earlier, much smaller "confirm this isn't an infinite loop" investigation of the
  same `dncbeta_cdf(2,2,1200,1200,x)` call under `--emit`'s cache-reuse path, whose ~65-minute
  timing figures this fix directly improves on for the `self_check()` path (which has no
  equivalent cache to fall back on).

## Key Insight

A nested double-summation's total cost is `(iterations) × (per-iteration cost)`; a fix that only
targets the iteration count (relocating a series-summation walk's starting point, in this case)
can look correct and principled while still leaving the dominant cost — an expensive special
function called fresh at every step — almost entirely untouched. Measuring the actual wall-clock
improvement, not just the fix's plausibility or correctness, is what surfaced this: peak
relocation was fully implemented and numerically verified correct before its ~19% real-world
improvement revealed the wrong lever had been pulled. The right fix — tracking the expensive
special function itself via an exact O(1) recurrence, leaving the walk's structure entirely
unchanged — delivered the 19-40x improvement the issue needed, and was only found by profiling
*why* the first attempt underperformed rather than accepting a partial win.
