---
date: 2026-08-04T08:23:00Z
category: "correctness"
problem: "DoublyNoncentralT.pdf() loses precision at large nu because _fnmDiff's saturation gate uses a flat threshold that doesn't scale with nu, the same mechanism #1325 fixed in NoncentralT._pdf"
status: complete
related_issue: "1332"
related_plan: "thoughts/plans/2026-08-04-0823-doubly-noncentral-t-nu-scaled-saturation-gate-fix.md"
tags: [doubly-noncentral-t, noncentral-t, catastrophic-cancellation, saturation-gate, nu-scaled-threshold, precision]
---

# Solution: nu-scaled saturation-gate threshold for DoublyNoncentralT._fnmDiff, with a documented residual precision ceiling at extreme nu

**Date**: 2026-08-04T08:23:00Z
**Category**: correctness
**Related Issue**: #1332

## Problem

Issue #1325 found and fixed a nu-scaled precision bug in `NoncentralT._pdf`'s fast CDF-differencing
path (`nu * (a - b) / x`): its `nearOppositeBoundary` saturation gate used a flat
`Math.abs(a - b) < 1e-9` threshold that didn't scale with `nu`, so at large `nu` (~10000+) the fast
path silently returned a value with catastrophic relative error. #1325's own text flagged that
`DoublyNoncentralT` has the structurally identical flat-`1e-9` gate pattern at two sites in
`_fnmDiff` (`_pdf`'s `_pdfPoissonMixture`) and `_cdfTerm` (`_cdf`), untouched by that fix (whose scope
was explicitly restricted to `src/dist/noncentral-t.js`), and filed the question of whether the same
fix generalizes as issue #1332.

## Root Cause

**Confirmed via direct numerical comparison against an independently re-derived mpmath (`mp.dps=50`)
reference** (`scripts/precision-refs-continuous.py`'s existing `dnct_pdf`/`dnct_cdf` formulas, never
read off the ranjs implementation): `DoublyNoncentralT.pdf()`'s relative error grows with `nu`,
negligible (~1e-10) at `nu=1000`, ~9e-8 at `nu=10000`, ~1e-5 to 1.2e-5 at `nu=100000` — the same order
of magnitude, at the same `nu` values, #1325 measured for `NoncentralT.pdf()` before its own fix. The
mechanism is structurally identical: `_pdfPoissonMixture`'s Poisson-mixture accumulator multiplies
each term by `t.nu0 * t.f`, where `t.f` is `_fnmDiff`'s `fnm`-difference and `nu0` grows exactly like
`NoncentralT._pdf`'s own `nu` — the same cancel-then-amplify shape as `nu * (a - b) / x`, just summed
over multiple Poisson-weighted terms instead of evaluated once. `_cdfTerm`'s Poisson-mixture sum
(used by `_cdf`) does **not** multiply by `nu0` the same way — confirmed via the identical comparison,
`.cdf()`'s relative error stays within ordinary floating-point noise (~1e-11 to 1e-13) regardless of
`nu`, with no growth trend. `_cdfTerm`'s gate needed no change.

**A second, independently discovered finding: naively porting #1325's exact threshold formula
(`nu * Number.EPSILON * 1e10`) into `_fnmDiff`'s gate only partially closes the gap, and the shortfall
is structural, not a tuning problem.** Substituting the scaled threshold and re-running the mixture
sum: `nu=10000` relative error roughly halves (8.8e-8 → 4.4e-8), `nu=50000` improves ~5x
(3.2e-6 → 6.0e-7), but `nu=100000` barely moves (1.2e-5 → 1.06e-5). The reason: `_fnmDiff`'s fallback
is `NoncentralT.snm(lo.nu, ...) - NoncentralT.snm(hi.nu, ...)` — a **difference of two independently-
quadratured values**, unlike `NoncentralT._pdf`'s #1325 fallback (`_pdfDirect`, a single
cancellation-free density quadrature with no subtraction anywhere). Measured directly:
`NoncentralT.snm` itself stays accurate to ~1e-11–4e-11 relative error even at `nu` up to 100002 — but
that is an **absolute** noise floor of the same order on each call. Once `nu0` grows large enough that
the true `snm(lo) - snm(hi)` difference itself shrinks to a comparable ~1e-6–1e-5 magnitude (exactly
the regime the gate now routes into), that ~1e-11 absolute floor is no longer negligible relative to
the difference being computed, reintroducing a smaller-scale version of the same cancellation problem
the gate exists to route away from, one level down.

## Fix

Ported #1325's threshold formula into `_fnmDiff`'s `nearOppositeBoundary` condition, keeping the
existing `lo.nu >= 30` guard intact (mirroring how #1325 kept `NoncentralT._pdf`'s own `nu >= 30`
guard):

```diff
- const nearOppositeBoundary = lo.nu >= 30 && Math.abs(diff) < 1e-9
+ const nearOppositeBoundary = lo.nu >= 30 && Math.abs(diff) < lo.nu * Number.EPSILON * 1e10
```

This is a one-line production change, verified against every existing `DoublyNoncentralT`
precision-gate test point (all 30 points across the 8 existing groups in
`test/precision-continuous.js`, plus the boundary-precision pins in
`test/precision-noncentral-t-boundary.js`) with **zero regressions**. At the already-tested
`[5, 2, 120]` parameter set — whose Poisson-mixture terms reach `nu0` up to ~145, well past the
`nu0 >= 30` guard — the fix is not merely safe but a dramatic, already-reachable improvement:
`pdf(x=-0.7)`'s relative error tightens from ~1.7e-9 to ~7.3e-15, a ~235,000x tightening. That
group's `tol` is tightened from `3e-9` to `2e-12` (~9x margin over the new ~2.2e-13 worst case) in
`test/precision-continuous.js` (a hand-maintained `PRESERVE_VERBATIM` group — edited directly, not
via `--emit`, per `scripts/precision-refs-continuous.py`'s own convention for that group; its
tolerance-dict entry there is kept as a documentation-only mirror).

**The residual limitation at extreme `nu` (>= 10000) is deliberately left in place, not chased
further**, per an explicit user decision after a propose/critique design review returned Low
confidence between "document only, no code change" and "apply the partial fix." The user chose to
apply the fix. A new hand-written pin,
`DoublyNoncentralT(50000, 0.01, 0.1).pdf(-0.5)` in `test/precision-noncentral-t-boundary.js`, guards
the *improved-but-imperfect* precision this fix delivers there (confirmed RED against the pre-fix
flat threshold at `tol: 1e-6`, GREEN against the nu-scaled threshold) — it is explicitly not a
full-precision claim, unlike every other pin in that file.

**A second, independently discovered problem surfaced only once the threshold fix was run against
the full test suite (not just its own reproduction case): `.fit()`'s Powell optimizer, on data that
isn't genuinely `DoublyNoncentralT`-shaped, has no interior optimum in `nu`/`theta` — the same class
of problem #1325 found for `NoncentralT.fit()` on the identical VonMises(0,2)-sampled data.** The
nu-scaled gate fires far more often than the flat `1e-9` threshold it replaced — not only at extreme
`nu`, but across the entire `nu0 >= 30` range, whenever a Poisson-mixture term's raw difference falls
under the wider scaled threshold — so an unbounded search that explores such data pays the added
`NoncentralT.snm`-fallback cost across hundreds of thousands of likelihood evaluations. Measured:
`DoublyNoncentralT.fit()` on this exact reproduction data went from ~6s pre-#1332 to ~68s post-#1332
with an unbounded search, an ~11x regression invisible to any test that only exercises the reported
correctness fix's own reproduction case — this surfaced only as a `test/guess.js` mocha timeout under
full-suite `--parallel` execution, not from any targeted test of the fix itself.

## Fix, continued: bounded Powell search budget

`DoublyNoncentralT` gains a `static _powellOptions()` (`{ tol: 1e-2, maxIter: 15 }`, matching
`DoublyNoncentralBeta`'s values rather than `NoncentralT`'s tighter `1e-3` — this class has one more
free parameter and a similarly ridge-shaped likelihood on mismatched data), mirroring the established
`_powellOptions()` pattern (#1063, #1325). Bounds the pathological case back to ~18s alone, ~34s
inside `guess()`'s full default-pool sweep (matching that sweep's own pre-existing ~24-34s baseline
for this exact case), verified via TDD: a `NoncentralT.snm` call-count regression test (confirmed RED
without the fix — measured 120228 calls against a 60000 ceiling — GREEN with it, in
`test/dist-base-fit-3.js`) and a quality-preservation test confirming no intolerable lnL degradation
on well-matched data (this class's likelihood carries a mild nu/theta ridge even on well-matched data,
unlike `NoncentralT`'s near-bit-identical bounded-vs-unbounded result, so the tolerance there is
calibrated to the measured ~0.005-0.6 range across seeds rather than assumed near-zero).

**Why no further fix was attempted.** A genuinely cancellation-free replacement for `_fnmDiff`'s
fallback would need a direct quadrature of the *difference* of two noncentral-t CDFs (or,
equivalently, of the Poisson-mixture term itself) — there is no existing single-call primitive that
computes this the way `_pdfDirect` computes a single density value. Building one is a materially
larger undertaking than a threshold change and was scoped out of #1332, whose acceptance criteria
only asked to investigate and, if the mechanism generalizes cleanly, apply the same fix — not to
design a new numerical primitive. `nu >= 10000` is also unreachable through any normal usage path:
`_fitInit`'s moment-matching seed cannot practically push `nu` that high for real data, and every
existing test case uses `nu` in {5, 6}.

## Prevention Strategy

**A correctness fix that routes a hot path to a materially more expensive fallback must be checked
against `fit()`'s optimizer separately from the direct-call case — this is not automatically caught
by testing the reported bug's own reproduction case.** #1325's own solution doc already named this
exact lesson, in the context of the structurally identical `NoncentralT._pdf` fix. It was not
generalized as a proactive check here despite that precedent being directly on point, and the
regression it warned about materialized anyway — caught only by running the full test suite, not by
any test targeted at this fix. Future gate-threshold changes on this file family should run
`test/guess.js`'s default-pool sweep explicitly before considering the fix complete, rather than
relying on it to be caught incidentally by a full `npm test` run.

**A parameter-scaled noise floor needs a parameter-scaled gate threshold — but check whether the
*fallback itself* is cancellation-free before assuming the same threshold formula closes the gap the
way it did elsewhere.** #1325's fix worked cleanly for `NoncentralT._pdf` specifically because its
fallback (`_pdfDirect`) has no subtraction anywhere in its evaluation. Porting the identical threshold
onto a different call site whose fallback is itself a difference of two quadratures only pushes the
cancellation problem to a smaller scale, not away — this is not visible from reading the threshold
formula alone, only from measuring the fallback's own behavior once the gate routes into it at the
scale the new threshold now reaches.

**A "does this fix generalize" issue can uncover a real, already-reachable bug even when its own
premise (an unreachable extreme-`nu` regime) turns out to be only partially resolvable.** The
investigation here found the naive threshold port doesn't fully fix the extreme-`nu` case #1325's own
issue text worried about — but it also found, empirically, that the identical change closes a large,
already-measured gap at a `nu` scale (`~30-145`) this library's own existing test suite already
exercises. Measuring the fix against every existing test point (not just the extreme case the issue
was framed around) is what surfaced this — a narrower verification scoped only to `nu >= 10000` would
have missed it.

## Related Solutions

- `solutions/correctness/2026-08-03-1336-noncentral-t-large-nu-pdf-precision-fix.md` (#1325) — origin
  of the `nu * Number.EPSILON * 1e10` threshold formula this fix ports. Its own text named this exact
  follow-up (filed as #1332) and predicted the fallback-structure difference this investigation
  confirmed.
- `solutions/correctness/2026-08-02-2040-noncentral-t-fnmdiff-saturation-fix.md` (#1318) — established
  the "stop patching the gate a third time, replace the cancellation-prone identity" prevention rule.
  This fix does not follow that rule to its full conclusion — it retunes the gate rather than
  replacing `_fnmDiff`'s fallback with a cancellation-free primitive — a deliberate, scoped-out
  decision (see "Why no further fix was attempted" above), not a disagreement with #1318's own
  reasoning: no cancellation-free CDF-*difference* primitive currently exists to replace it with.
- `solutions/correctness/2026-07-31-1300-doubly-noncentral-t-pdf-cancellation-x-mu-negative.md`
  (#1235) — precedent for documenting a residual, structurally-unfixable-at-this-call-site limitation
  rather than chasing it further; this fix's residual-ceiling documentation follows the same pattern.
- `thoughts/research/2026-08-04-0811-doubly-noncentral-t-nu-scaled-saturation-gate.md` — the full
  empirical investigation behind this fix, including the design-decision propose/critique review.

## Key Insight

Porting a parameter-scaled gate threshold from one call site to a structurally similar one is only as
good as the *fallback* it routes into — a fix that worked because its fallback was cancellation-free
does not automatically generalize to a fallback that is itself a difference of two quadratures, which
only relocates the cancellation problem to a smaller scale rather than eliminating it. Measuring the
change against the *entire* existing test suite (not just the reported extreme case) is what revealed
both halves of this story: the naive fix under-delivers exactly where the issue worried it might, and
over-delivers at a scale nobody was specifically asking about.
