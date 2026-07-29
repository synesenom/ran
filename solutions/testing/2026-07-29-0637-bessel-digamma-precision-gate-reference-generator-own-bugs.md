---
date: 2026-07-29T06:37:50Z
category: "testing"
problem: "A new mpmath-based precision-gate generator for besselI/besselISpherical/besselInu/besselK/besselKnu/digamma had no independently-vetted reference file to self-check against, so bugs could hide in the generator's own reference formulas rather than the code under test"
status: complete
related_issue: "#1140"
related_plan: "thoughts/plans/2026-07-28-1900-bessel-digamma-precision-gate.md"
tags: [precision-refs, special-functions, bessel, digamma, boundary-grid, reference-generator, dead-code, review-catches-tooling-bugs]
---

# Solution: Bessel/digamma precision-gate — the reference generator needed its own boundary review, not just the code under test

**Date**: 2026-07-29
**Category**: testing
**Related Issue**: #1140

## Problem

Issue #1140 asked for a dense, threshold-focused precision gate validating `besselI`,
`besselISpherical`, `besselInu`, `besselK`, `besselKnu` (`src/special/bessel.js`) and `digamma`
(`src/special/digamma.js`) against an external reference, mirroring the existing
`test/precision-continuous.js` / `scripts/precision-refs-continuous.py` pattern used for
distributions. But that existing pattern has a load-bearing property this issue's target lacked:
`precision-refs-continuous.py`'s `self_check()` cross-validates its own mpmath-derived values
against `test/dist-cases-continuous.js`'s already scipy-vetted `refVals` — an independent second
source. Bare special functions have no such file. The new generator
(`scripts/precision-refs-special.py`) was therefore both the reference source *and* the only
check on itself, with nothing external to catch a mistake in its own formulas.

That gap was not hypothetical. `/review` (not the initial implementation) found that
`besselISpherical_ref`'s `x=0` guard returned `mpf(0)` for every non-zero order, but the true
value of `i_n(0)` for *negative* `n` diverges to `+Infinity` (e.g. `i_{-1}(0) = cosh(0)/0`, per
the same DLMF 10.47.9 identity the function itself implements) — a bug in the test tooling, not
in `src/special/bessel.js`. It was latent only because the grid never happened to probe `x=0` for
negative order; had a later contributor extended the grid without knowing this, the generator
would have silently emitted a wrong reference value.

## Root Cause

The generator's reference formulas (`besselI_ref`, `besselISpherical_ref`, `besselInu_ref`,
`besselK_ref`, `besselKnu_ref`, `digamma_ref`) were written and trusted the way production code
is trusted — but without production code's usual safety net (existing tests, existing callers,
an independent vetted reference). `besselISpherical_ref`'s `x=0` special case was added
correctly for the `n >= 0` cases the initial grid happened to include, but the `n < 0` branch was
never exercised, so the wrong hardcoded `mpf(0)` shipped unnoticed. The same class of gap showed
up in three more places found by the same review pass: a tolerance bucket that lumped `x=10`
into a much looser neighboring cluster (so a real ~2-order-of-magnitude regression at `x=10`
would have silently passed); a divergence-handling branch in the comparison logic
(`_mismatch_message`) that was written for "besselK at x=0" but had no grid point ever
triggering it (dead code in the test tooling itself); and weak failure diagnostics (a bare
boolean `assert` instead of `assert.approximately`, which would have made a future real failure
harder to debug). All four were mechanically the same failure mode: *the grid didn't exercise
every branch the reference/comparison code itself has a special case for.*

This is the same failure class as `solutions/testing/2026-07-24-1456-chi-noncentralbeta-pdf0-zero-times-inf-boundary.md`
(issue #1116), where `precision-refs-continuous.py`'s `chi2_pdf`/`ncbeta_pdf` hardcoded `pdf(0)=0`
and missed a `0·∞` boundary composition — a bug in the reference generator, not the distribution
under test, also only caught once something forced the boundary to actually be evaluated.

## Fix

Built the generator anyway, since a threshold-focused grid is still far more effective than no
grid at all (issue #1185's `besselI(0,x)` bug — a real production bug, not a tooling bug — was
found exactly this way, by a grid deliberately bracketing `x=10`). To compensate for having no
independent second reference source, `/review`'s correctness/tests passes were pointed explicitly
at the *generator's* branches, not just the production code's: for every special case the
reference function itself handles (`x=0`, negative-order divergence, near-integer snap
thresholds), confirm a grid point actually lands there. Four fixes landed as a result, none of
which touched `src/special/`:
1. `besselISpherical_ref`'s `x=0` guard corrected for negative order, plus a grid point added
   (`besselISpherical(-1, 0)`) to exercise it — this in turn required decoding `Infinity`/`NaN`
   correctly through the JSON bridge and a divergent-reference assertion branch in the emitted
   test, both of which the previously-unreached code path had never forced into existence.
2. The `x=10` tolerance bucket for `besselK`/`besselKnu` split out from the looser `x=6.01/6.1`
   cluster into its own `tol=1e-9` bucket, sized from the actually-measured worst-case error.
3. A `besselK`/`besselKnu` `x=0` grid point added so the divergent-reference comparison path is
   no longer dead code.
4. The emitted assertions switched from bare `assert(bool)` to `assert.approximately`, matching
   the diagnostic convention already used by `test/precision-continuous.js`/`-discrete.js`.

Two genuine findings *in the production code under test* (not the generator) were deliberately
left unfixed, per the issue's explicit test-only scope: `besselInu`'s overflow to `Infinity` for
very negative fractional order near the ~710 series boundary (withheld from the gate, documented,
filed separately as #1215) and `besselK`/`besselKnu`'s now-quantified ~1e-7 accuracy dip just past
the `x=6` series/asymptotic crossover (judged expected asymptotic-series behavior near its
validity boundary, not a bug — handled with a named-mechanism tolerance rather than filed).

## Prevention Strategy

When a new precision-gate generator has no independently-vetted second reference source to
`self_check()` against (true for any *new* special-function or algorithm precision gate — not
just this one), review it with the same rigor as production code, specifically checking:
1. Does every special case the *reference* function itself branches on (not just the production
   function) have a grid point landing on it? A reference formula with an unexercised `if x == 0`
   branch is exactly as dangerous as a production bug, and much easier to miss because reviewers
   default to scrutinizing the code under test, not the code doing the checking.
2. Is every tolerance bucket keyed by a named numerical mechanism, and not accidentally merged
   with a looser neighboring bucket that happens to share a `for` loop?
3. Does every branch in the comparison/mismatch logic actually get triggered by some grid point?
   Dead code in test tooling is a silent gap, not a passing test.
4. Do failure assertions produce diagnosable actual/expected/tolerance output, not just a bare
   boolean?

## Related Solutions

- `solutions/testing/2026-07-24-1456-chi-noncentralbeta-pdf0-zero-times-inf-boundary.md` (#1116)
  — the closest precedent: a boundary bug in `precision-refs-continuous.py`'s own reference
  formula (`pdf(0)` hardcoded instead of handling the `0·∞` composition), not in the distribution
  under test.
- `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md` (#1110) — a
  reference generator's self-check can be silently broken (never actually running) for a long
  time; this issue's generator had no self-check to break in the first place, which is the more
  fundamental version of the same risk.
- `solutions/special-functions/2026-07-26-1839-bessel-i-miller-n0-margin-degeneration.md` (#1185)
  — the precedent that motivated this issue's threshold-focused (not brute-force) grid design: a
  real `besselI(0,x)` bug was found exactly by bracketing a documented dispatch threshold.

## Key Insight

For a special function with no pre-existing vetted reference file, the biggest risk isn't finding
bugs in the function under test — it's shipping a reference generator whose own formula has an
unexercised edge case, so review must interrogate the grid against the *reference* function's
branches, not just the *production* function's branches.
