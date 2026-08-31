---
date: 2026-08-31T20:14:15Z
category: "testing"
problem: "~1e-4 relative precision gap between ran.dist.Kolmogorov and R's ks.test, left tolerance-documented but unresolved by issue #1270"
status: complete
related_issue: "#1412"
related_plan: "thoughts/plans/2026-08-31-1932-kolmogorov-cdf-precision-gap.md"
tags: [kolmogorov, precision-gate, mpmath, ground-truth, R, ks.test, pkstwo, tolerance]
---

# Solution: Kolmogorov cdf precision gap vs R's ks.test

**Date**: 2026-08-31T20:14:15Z
**Category**: testing
**Related Issue**: #1412

## Problem

Issue #1270's hypothesis-test precision gate (`test/precision-test.js`) found that `ran.dist.Kolmogorov().survival()`/`.cdf()` differs from R's `ks.test(..., exact=FALSE)` asymptotic p-value by up to ~1e-4 relative error at some arguments (example: at `z = 0.98552065998180416`, ranjs gives `0.2858453514455016`, R gives `0.28587293091131405`). The gap was isolated directly to the Kolmogorov distribution's own `_cdf`/`survival()` — not to `ran.test.kolmogorovSmirnov`'s D-statistic or `ne` scaling formula, both of which already matched R to float64 noise. It shipped with the gap merely tolerance-documented (`_TOL_KOLMOGOROV_DIST_PRECISION = 1e-4`) and flagged for Bug Triage, leaving open whether `src/dist/kolmogorov.js` had a real numerical defect.

## Root Cause

Both `ran.dist.Kolmogorov`'s `_cdf` (`src/dist/kolmogorov.js`) and R's `pkstwo`/`K2l()` (`src/library/stats/src/ks.c`) evaluate the *identical* theta-series `Σ_{k=-∞}^{∞} (-1)^k e^{-2k²x²}`, but with different loop-termination criteria: ranjs terminates once the next term is smaller than `Number.EPSILON` *relative* to the running partial sum, while R's `ks.test` hardcodes an *absolute* `tol=1e-6` on the successive-partial-sum difference — six orders of magnitude looser, and not scaled to the sum's own magnitude.

An independent `mpmath` computation at `mp.dps=50` for `z = 0.98552065998180416` gave ground truth `survival(z) = 0.28584535144550154703679675822`. `ran.dist.Kolmogorov().survival(z)` matches this to `1.85e-16` relative error (machine precision); R's `ks.test` p-value is off by `9.65e-5` — three orders of magnitude worse.

This is a case where the codebase's general convention of sourcing hypothesis-test references from R (because `ran.test.*` functions are meant to reproduce R's own behavior) had silently been extended into an unstated assumption that "R is also the numerical ground truth for every intermediate quantity." That assumption holds for the rest of the `kolmogorovSmirnov` pipeline (D-statistic, `ne` scaling — both confirmed matching R to float64 noise) but breaks down specifically for R's own asymptotic Kolmogorov CDF sub-computation, which has its own looser internal tolerance.

## Fix

No `src/` change was needed or made — the investigation determined `ran.dist.Kolmogorov` was already correct to machine precision. The resolution was entirely documentation plus a regression guard, following two conventions already established elsewhere in the same files:

1. Renamed `_TOL_KOLMOGOROV_DIST_PRECISION` → `_TOL_R_PKSTWO_ASYMPTOTIC_LIMIT` in `scripts/precision-refs-test.py` and rewrote its comment from an open "flagged for Bug Triage" question into a closed, cited conclusion — mirroring the neighboring `_TOL_AD_ERRFIX_DIVERGENCE` pattern used for other documented R-vs-ranjs numerical divergences in the same file.
2. Pinned the exact flagged `z` value (`0.98552065998180416`) with its mpmath-derived `pdf`/`cdf` as a permanent regression point in `test/precision-continuous.js`'s existing 5-point Kolmogorov precision gate (now 6 points), with a matching provenance comment block added to `scripts/precision-refs-continuous.py` — mirroring the existing `NORMAL_FAR_TAIL_XVALS`/`DNCT_NEGX_XVALS` precedent for hand-pinned points that sit outside the generator script's standard `P_GRID` sweep.

## Prevention Strategy

When a precision gate flags a gap between ranjs and an external reference tool (R/scipy) that is known to implement the *same formula* ranjs does — not just the same statistical procedure — do not default-assume the external tool is the more accurate side. That assumption is only safe for the tool's black-box top-level output in general; it does not automatically extend to every internal numerical routine the tool happens to call, some of which may carry their own looser hardcoded tolerances (as R's `pkstwo` does here).

Before tightening ranjs's own implementation or leaving the gap as an open, tolerance-documented question for later, get an independent, arbitrary-precision third opinion (`mpmath` at high `mp.dps`) on the exact same computation, and pin whichever value the ground truth vindicates as a permanent regression point at the exact flagged input. This closes the "is it us or them" question definitively rather than leaving a named tolerance constant open-ended indefinitely.

## Related Solutions

- `solutions/testing/2026-05-20-0900-noncentral-ad-root-cause-errfix-artifact.md` — a similar R-vs-ranjs precision investigation, but with the opposite conclusion: that case found a genuine ranjs `_errfix` transcription bug. Contrast is instructive: not every flagged R-comparison gap has the same root cause, so each must be independently ground-truthed rather than assumed to follow the same pattern as a prior investigation.
- `solutions/testing/2026-07-25-1032-cvm-scipy-public-wrapper-scope-mismatch.md` — another R/scipy-comparison investigation, there caused by a reference-library scope/formula mismatch rather than a numerical tolerance difference.

## Key Insight

A precision gap against an external reference (R/scipy) is not proof the reference is right — when both sides implement the identical series/formula, an independent mpmath ground-truth check can reveal the *reference tool's own* loop-termination tolerance (R's hardcoded absolute `tol=1e-6` vs. ranjs's relative `Number.EPSILON`) is the actual source of error, not the ranjs implementation.
