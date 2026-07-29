---
date: 2026-07-29T20:07:17Z
category: "testing"
problem: "test/dist-cases-continuous.js's Normal far-tail refVals were stale and undetected by Mocha's own assertions"
status: complete
related_issue: "#1193"
related_plan: "thoughts/plans/2026-07-29-1925-normal-cdf-far-tail-precision-mismatch.md"
tags: [refValTol, absolute-vs-relative-tolerance, stale-reference-value, precision-refs, self-check, normal-distribution, far-tail]
---

# Solution: Normal far-tail `refVals` stale, hidden by an absolute-floor tolerance helper

**Date**: 2026-07-29
**Category**: testing
**Related Issue**: #1193

## Problem

`scripts/precision-refs-continuous.py`'s `self_check()` (a dev-only regression tool that compares its own mpmath-derived Normal CDF/PDF against the frozen `refVals` in `test/dist-cases-continuous.js`) flagged `Normal[0,2].cdf(-14)` as mismatched: computed `1.279812543885835e-12` vs. frozen `1.279809591636649e-12`, a relative error of 2.31e-6 — over the self-check's `5e-7` threshold. This raised the question of whether the script's own mpmath formula was the one at fault.

## Root Cause

Two compounding issues, not one:

1. **An incomplete backport.** A prior fix (issue #808) applied a cancellation-safe `erfc` reformulation to Normal's far-tail probes, but only landed in `test/precision-continuous.js` (the generated precision-gate file). It was never back-ported to the older, hand-authored `test/dist-cases-continuous.js`, which independently stores the same `x = ±14` points via a different array (`refVals`, consumed by `test/dist-runner.js`'s Mocha assertions). Three independent mp.dps=50 formulations — plain `erf`, `erfc`, and mpmath's built-in `ncdf` — all agreed to ~44 significant digits and confirmed the script's formula was correct all along; the stale value was `1 ULP` off for `pdf` and `~2.3e-6` relative for `cdf` in `dist-cases-continuous.js`.

2. **A blind tolerance helper.** Mocha's own analytical suite never caught this staleness because `checkRefVals()`'s tolerance helper, `refValTol()` (`test/test-utils.js:226-232`), uses a flat `1e-14` *absolute* floor. At magnitudes near or below that floor (`pdf ≈ 4.57e-12`, `cdf ≈ 1.28e-12`), the absolute floor swamps any real error — the assertion passes identically whether the reference is exactly correct or wrong by several parts-per-million. The only thing that ever caught the staleness was an unrelated dev-only script's *relative*-error self-check, which had itself only recently been made to actually execute (see `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md`).

## Fix

Corrected the four stale float64 literals (`pdf`/`cdf` at `x = -14` and `x = 14`) in `test/dist-cases-continuous.js` to the mpmath-verified values. Added a WHY comment there showing the explicit mpmath computation → result and calling out, by name, that `refValTol`'s absolute floor cannot verify precision at this magnitude — pointing future readers at `test/precision-continuous.js`'s tight relative-tolerance far-tail block as the real regression authority. Added a comment above `self_check()` in `scripts/precision-refs-continuous.py` documenting that a self-check mismatch does not by itself indict the script's own formula — either side (script or frozen reference) can be the stale one, and each mismatch needs independent re-derivation before deciding which to correct. Added a `CHANGELOG.md` bullet. No production code (`src/`) was touched; this was a test-data correction plus documentation, deliberately not a change to the shared `refValTol` helper (out of scope for this issue — see Prevention Strategy).

## Prevention Strategy

- When a numerical fix touches a reference value that's duplicated across multiple test files covering the same distribution/point (e.g. a hand-authored `dist-cases-*.js` case and a generated `precision-*.js` gate for the same `(distribution, x)` pair), search across `test/` for every place that value is stored — fixing only the file under active edit leaves the others stale, exactly as happened here after issue #808.
- A tolerance helper that mixes absolute and relative comparison (like `refValTol()`) is safe only while every checked value stays comfortably above the absolute floor. Once assertions start covering deep-tail probabilities that shrink toward the floor's own magnitude (as `dist-cases-continuous.js`'s far-tail Normal probes now deliberately do), the absolute term stops discriminating "correct" from "wrong by many ULPs" — it silently turns that specific assertion into dead code that always passes. Don't add flat-absolute-floor tolerance checks at arbitrarily small magnitudes without also asking whether a relative check is needed to keep the assertion meaningful.
- A self-check/regression-guard whose own domain formula agrees with itself under multiple independent reformulations (here: `erf`, `erfc`, `ncdf`) is strong evidence the mismatch lies in the *comparison target*, not the guard — worth checking before assuming a long-trusted internal formula regressed.

## Related Solutions

- `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md` — the self-check mechanism that caught this mismatch was itself dormant until recently fixed (#1110); that solution's own prevention strategy predicted exactly this pattern: a newly-working safety net keeps surfacing pre-existing latent discrepancies one at a time, to triage rather than absorb wholesale.

## Key Insight

A tolerance helper with a flat absolute floor cannot detect a stale reference value once the expected magnitude drops near or below that floor — only a relative-error check can catch far-tail precision regressions, so any reference-value fix at extreme magnitudes must be cross-checked against every file that stores the same value, not just re-verified against the (blind) assertion in the file being edited.
