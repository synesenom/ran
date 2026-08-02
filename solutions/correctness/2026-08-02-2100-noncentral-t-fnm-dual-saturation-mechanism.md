---
date: 2026-08-02T21:00:00Z
category: "correctness"
problem: "DoublyNoncentralT(5,5,120).pdf(-0.2) and .cdf(-0.1) still wrong after #1250's fnm/snm fallback gate, via two blind spots the magnitude-based gate could not see"
status: complete
related_issue: "1298"
related_plan: "thoughts/plans/2026-08-02-1900-noncentral-t-fnm-precision-floor-1298.md"
tags: [noncentral-t, doubly-noncentral-t, catastrophic-cancellation, precision-gate, fallback-gate-design, regression-testing]
---

# Solution: `NoncentralT.fnm`'s dual saturation mechanism — a union, not a replacement, of trustworthiness checks

**Date**: 2026-08-02T21:00:00Z
**Category**: correctness
**Related Issue**: #1298

## Problem

Issue #1250 (`solutions/correctness/2026-08-01-2030-noncentral-t-fnm-snm-boundary-saturation.md`)
added `NoncentralT.snm` and a `nu0 >= 30 && |raw value| < 1e-9` magnitude-based gate to
`DoublyNoncentralT._fnmDiff`/`_cdfTerm`, fixing `DoublyNoncentralT(5, 5, 120).pdf/cdf(-0.7)`. Issue
#1298 was filed against the same mechanism at shallower `x`, and — on the code as it stood right
after #1250 merged — two of its three reported points remained wrong: `pdf(-0.2)` was ~2e-3 relative
error, and `cdf(-0.1)` (a case #1298's own acceptance criteria assumed was unaffected, since only
`cdf(-0.2)` had been measured) was ~14.5x wrong.

## Root Cause

`NoncentralT.fnm(nu, mu, x)` computes `phi + z/2` in linear space, where
`phi = 0.5*(1+erf(-mu/√2))` depends only on `mu` and `z` is the `nu`-dependent AS243 correction. A
raw `fnm` call becomes untrustworthy in **two structurally independent ways**, and #1250's gate
could only detect one of them:

1. **Stuck at `phi`**: `z/2` is too small to separate from `phi` at all, so `fnm` returns `phi`
   bit-for-bit (or near-bit-for-bit). Two such calls being differenced (`_fnmDiff`) produce a
   `diff` of exactly (or near) `0` — the case #1250's magnitude gate was tuned against.
2. **Resolved but re-saturating**: `z/2` *did* separate from `phi` — the value is genuinely
   different, not stuck — but is itself now close enough to the *opposite* boundary (`0` or `1`)
   that the double holding it can't represent the remaining gap. This is #1250's own reported
   case (`x=-0.7`): successive `nu0`'s `fnm` values climb steadily away from `phi` and toward
   exactly `1.0` as `nu` grows.

These are not nested — case 2's value is, by construction, *far* from `phi` (that's what "resolved"
means), so a `phi`-equality check cannot see it; case 1's value is exactly at `phi`, so the
magnitude-of-the-raw-value check (case 2's own detector) doesn't reliably see it either, because at
the specific "knife-edge" `nu0` where one of two differenced operands is stuck at `phi` and the
other has already resolved, their raw difference is dominated by the stuck operand's own error and
lands at `~1e-7` — *wrong but not small enough* to trip a `< 1e-9` gate. `_cdfTerm`'s case is
starker still: an entire contiguous low-`nu0` range can sit at exactly `1 - phi` (`~2.87e-7` for
`mu=5`), never dropping below the `1e-9` threshold on any term in that range, so the fallback never
fires for the whole plateau.

## Fix

Added a second, independent check — direct `phi`-equality (`|fnm_result - phi| < 1e-12`, computed
locally from the `mu` each helper already receives, valid because both call sites always invoke
`fnm` with `x >= 0`, which collapses `fnm`'s own `delta = x<0?-mu:mu` to `delta = mu`) — as an **OR**
alongside the existing `nu0 >= 30 && |raw value| < 1e-9` magnitude gate, in both `_fnmDiff` and
`_cdfTerm`. Either condition independently triggers the fallback to `NoncentralT.snm`.

**The plan originally proposed replacing the magnitude gate with the phi-equality check** (dropping
`nu0 >= 30` entirely, reasoning that phi-equality was a "strictly more precise" signal). Implementing
that literally and running the full test suite immediately surfaced two regressions in
`test/precision-noncentral-t-boundary.js` — `DoublyNoncentralT(5,5,120).pdf(-0.7)` and `.cdf(-0.7)`,
the exact case #1250 fixed, both broke, because case 2 above is invisible to a pure `phi`-equality
test. The fix was corrected mid-implementation to keep both checks as a union rather than swap one
heuristic for the other.

## Prevention Strategy

**When a numerical trustworthiness heuristic is found to have a blind spot, verify the replacement
still catches every case the old heuristic was validated against — by re-running that heuristic's
own original regression test, not just the new failure case's precision-gate assertions.** A more
precise-*looking* signal is not automatically a superset of the old one; two failure modes can be
independent facets of the same underlying phenomenon (here: "did the correction never separate from
`phi`" vs. "did the separated value independently hit the *opposite* boundary") rather than one
subsuming the other. `test/precision-noncentral-t-boundary.js` existing as a small, fast,
hand-written regression file separate from the generated precision gate is exactly what made this
catchable quickly — a purely generated-gate-driven validation loop would have re-measured only the
new points and could have shipped the regression.

**A stale-numbers trap on the second pass**: after correcting the code to the union-of-two-checks
design, the tolerance values and worst-case-error prose written during the *first* (later reverted)
implementation attempt were not automatically invalidated — they had to be explicitly re-measured
and re-written, since the corrected code's actual precision differs (in this case, improved further,
since the union gate now also benefits shallower `x` from the deep-tail mechanism). A code-review
pass (`review-tests`) cross-checked the new tolerances against measured worst-case error and found
them consistent, but did not have execution access to independently re-derive them — cross-checking
narrative claims against actual measured numbers after any code change made mid-implementation, not
just at the end, remains a manual discipline.

## Related Solutions

- `solutions/correctness/2026-08-01-2030-noncentral-t-fnm-snm-boundary-saturation.md` (#1250) — the
  direct predecessor. Its `NoncentralT.snm` fallback and `nu0 >= 30`/magnitude gate are **retained,
  not replaced**, by this fix; its own reported case (`x=-0.7`) still passes unchanged. Its
  "Prevention Strategy" claim that the threshold was validated to "fully resolve the reported
  saturation with zero regression" is accurate for its own specific reported case but incomplete as
  a general claim about `fnm`-saturation trustworthiness — an addendum has been appended there
  narrowing that scope and pointing here, mirroring that doc's own precedent of appending an
  "Addendum" section rather than being marked superseded (its core architecture and root-cause
  diagnosis remain correct).
- `solutions/correctness/2026-07-31-1300-doubly-noncentral-t-pdf-cancellation-x-mu-negative.md`
  (#1235) — the earlier predecessor whose own "Residual Limitation" section originated #1250.

## Key Insight

A single numerical saturation phenomenon can produce multiple, independently-triggerable
observational signatures — an operand stuck at a plateau versus an operand that has escaped the
plateau but independently saturates toward the opposite boundary — so a scalar heuristic gating an
expensive fallback should be checked against *every* previously-documented failure case via the full
regression suite before assuming a more targeted check supersedes, rather than merely supplements,
the one it's replacing.
