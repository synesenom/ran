---
date: 2026-07-18T16:41:32Z
category: "testing"
problem: "Hand-derived TDD reference values encoded the same wrong understanding of a cited algorithm as the implementation, so the full test suite passed while both were wrong"
status: complete
related_issue: "#975"
related_plan: "thoughts/plans/2026-07-18-1508-ess-naive-lag-truncation.md"
tags: [mcmc, ess, geyer, autocorrelation, test-methodology, external-verification, code-review]
---

# Solution: Geyer IPSM pairing offset in MCMC.ess() survived a fully green test suite

**Date**: 2026-07-18T16:41:32Z
**Category**: testing
**Related Issue**: #975

## Problem

`MCMC.prototype.ess()` (`src/mc/_mcmc.js`) truncated its autocorrelation-time sum at the first non-positive or NaN lag — a naive rule that let a single noisy negative early lag prematurely truncate the sum (overestimating ESS) and reported `ess === n` for a fully stuck, zero-variance chain. Issue #975 asked to fix this in `test/test-utils.js`'s `ess()` helper, but that location was stale: the algorithm had since been promoted to the public (still-unreleased) `MCMC.prototype.ess()`, with `test-utils.js` now just a thin `Math.min(...sampler.ess())` wrapper — a reminder that an issue's stated file/line location can go stale as fast as its description of the bug itself, so research should always re-locate the defect rather than trust the issue's references verbatim.

The harder problem surfaced during implementation. The first attempt replaced the naive rule with Geyer's IPSM (initial positive monotone sequence) estimator, paired starting at lag 1: `Gamma_m = rho[2m-1] + rho[2m]`, `tau = 1 + 2*sum`. This passed everything: `npm test` (337 tests in `test/mc.js`), `npm run standard`, `npm run jsdoclint`, and coverage thresholds all went green. Every hand-calculated test reference value in `test/mc.js`'s `.ess()` block matched.

## Root Cause

The pairing was offset by one lag from Geyer's actual published convention, which pairs `Gamma_m = rho[2m] + rho[2m+1]` starting at **lag 0** — using the identity `rho[0] = 1` to anchor the first pair — with `tau = -1 + 2*sum` (verified against the Stan reference manual and Geyer's own lecture notes). Nothing internal caught this because the hand-derived test reference values were computed by hand using the *same wrong pairing convention* as the implementation: the test suite and the implementation were mutually consistent while both encoding the same misunderstanding of the cited algorithm (Geyer 1992; Vehtari et al. 2021 / Stan / ArviZ, all cited in the JSDoc).

CLAUDE.md's testing convention ("reference values must be externally sourced... never derive a reference value from the ranjs implementation itself") guards against copying a value *out of a running implementation*, but structurally cannot guard against a human hand-deriving reference values using the same flawed mental model that produced the implementation. `npm test` passing only proves internal agreement, not agreement with ground truth — a wrong-but-self-consistent belief about how a published algorithm works survives red-green TDD unless the red step is checked against the actual external source.

## Fix

A `review-correctness` subagent, running as a mandatory stage of the `/review` pipeline, treated the JSDoc's literature citation as a checkable claim rather than trusting it, and used `WebSearch`/`WebFetch` to pull Stan's reference manual and Geyer's own lecture notes. That external check found the one-lag offset. The fix:
- Changed the loop to start pairing at `k = 0` (so the first pair always includes the identity `rho[0] = 1`).
- Changed `tau` to `-1 + 2*sum`, with a `sum === 0` fallback to `ess = N` (avoiding the nonsensical negative tau `-1 + 2*0 = -1` that would otherwise result when even the first pair is non-positive).
- Recomputed every hand-derived test reference value in `test/mc.js` from scratch under the corrected formula.

A second, independent re-review agent re-derived all `rho`/`Gamma` values from the raw sequences by hand (population-variance-normalized cross-products, per `decisions/0023-mcmc-accumulator-mechanics.md`'s documented `ac()` formula) to confirm the corrected numbers before merging.

## Prevention Strategy

For any fix that implements a named, citable algorithm (a published estimator, a standard numerical recipe, a textbook formula), the TDD "red" step must include an explicit verification pass against the *actual external source* — the paper, a reference implementation (Stan/ArviZ), or a textbook — not just an internally hand-derived calculation. A hand-derivation is only as good as the deriver's understanding of the algorithm, and that understanding is exactly what's under test. When citing an external algorithm in a JSDoc or commit message, treat the citation as a claim requiring verification (fetch the source, compare formulas term-by-term) as its own explicit step, not something left to be caught by chance during review.

This is exactly the kind of defect the `/review` pipeline's `review-correctness` stage exists to catch, and this incident is a concrete case where it earned its cost even though the full test suite, lint, and coverage gates were all already green — a good example to point to when the temptation is to skip that stage because "tests already pass."

## Related Solutions

- `solutions/correctness/2026-07-16-1422-hmc-mass-matrix-precision-inversion.md` — the session that originally discovered and filed #975; makes the same point from a different angle (ESS/mixing diagnostics can look better under a bug and are never sufficient on their own — pair them with a ground-truth or literature check).

## Key Insight

A test suite where the implementation and its "independently hand-derived" reference values are produced by the same reasoning about a published algorithm will pass every internal check while being wrong; the only reliable catch is comparing against the actual external literature, which is precisely what a correctness-focused review stage should do even after `npm test` is fully green.
