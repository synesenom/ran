---
date: 2026-07-18T15:26:20Z
category: "correctness"
problem: "HMC._MAX_PATH_LENGTH copied a sibling bound's numeric value (10000) without copying the reasoning that justified it for a different risk class"
status: complete
related_issue: "#989"
related_plan: "thoughts/plans/2026-07-18-1530-hmc-max-path-length-bound.md"
tags: [numeric-bounds, hmc, nuts, mcmc, safety-cap, dos-mitigation, code-review-blind-spot]
---

# Solution: HMC._MAX_PATH_LENGTH copied a sibling bound's value without copying its reasoning

**Date**: 2026-07-18T15:26:20Z
**Category**: correctness
**Related Issue**: #989

## Problem

`HMC._MAX_PATH_LENGTH` (introduced in #947, `src/mc/hmc.js`) capped `config.pathLength` at `10000`
by reusing the exact numeric literal from three sibling `MCMC` bounds (`_MAX_DIM`, `_MAX_LAG`,
`_MAX_AR_WINDOW`, `src/mc/_mcmc.js`). Those siblings prevent oversized `Float64Array`/`Uint8Array`
allocations and are justified by an explicit bytes-per-unit calculation. `pathLength` instead bounds
the number of leapfrog steps per HMC iteration, each invoking the caller-supplied `gradLogDensity`
callback twice (`src/mc/hmc.js` `_leapfrog`) — a cost entirely opaque to ranjs, unlike a typed
array's fixed per-element byte cost. `10000` was never independently justified against this risk
class or against HMC/NUTS literature; it was simply copied.

A full 8-agent parallel code review (security/performance/structure/conventions/tests/docs/
correctness/impact) of the original #947 PR had all returned "No issues found" — none of the agents
caught the mismatch, because the number *looked* consistent with its neighbors (same file family,
same "safety bound" purpose, same superficial code-review pattern of "does this number look sane").

## Root Cause

The bound's *value* was copied without copying the *reasoning* that justified that value for a
different risk class:

- **Allocation-footprint bounds** (`_MAX_DIM`/`_MAX_LAG`/`_MAX_AR_WINDOW`) guard a predictable,
  computable memory footprint (`dim * maxLag * 16` bytes) — `10000` is a defensible order-of-magnitude
  ceiling *there* because the per-unit cost (bytes) is fixed and known to ranjs.
- **Compute-cost / hang-prevention bounds** (`_MAX_PATH_LENGTH`) guard a count of calls to an
  arbitrary-cost, caller-controlled callback. There is no "bytes-per-unit" analog, and no literature
  supports `10000` as a reasonable ceiling — Neal (2011), the classic fixed-`L` HMC reference, gives
  no canonical value at all (this is precisely why NUTS/adaptive path-length methods were invented).
  Stan/PyMC/NumPyro's own adaptive analog, NUTS's `MAX_TREE_DEPTH = 10` (`src/mc/nuts.js:20`),
  already existed in this same codebase and caps at `2^10 = 1024` steps — two to three orders of
  magnitude below the borrowed `10000`.

Proximity in the codebase (same file family, adjacent constants) and superficial purpose similarity
("it's a safety cap") masked that the two bounds protect against structurally different failure
modes.

## Fix

Lowered `HMC._MAX_PATH_LENGTH` from `10000` to `1024` (`2^10`), deriving it from the codebase's own
comparable, already-literature-justified bound — NUTS's `MAX_TREE_DEPTH = 10`. The getter's comment
(`src/mc/hmc.js`) was rewritten to explicitly name the two risk classes and argue that borrowing
NUTS's ceiling is conservative, not aggressive: HMC's leapfrog step additionally applies an adapted
mass-matrix metric (`_applyInverseMetric`) that NUTS's identity-mass leapfrog does not, so HMC's
per-step cost is at least as high as NUTS's. Two hardcoded boundary-test literals (`test/mc.js`) and
the constructor's `@throws` JSDoc were updated to match. Since the original `10000` bound had never
shipped in a release (still under `CHANGELOG.md`'s `## [Unreleased]`), the existing bullet was
amended in place rather than requiring a deprecation cycle.

## Prevention Strategy

When introducing a new numeric safety bound by referencing an existing one (same file, sibling
class, or otherwise), classify what risk class the bound guards against *before* reusing its value:

- **Allocation-footprint bounds** (typed-array sizes, buffer lengths) — justified by an explicit
  bytes-per-unit calculation; siblings sharing the *same* per-unit cost model can validly share a
  numeric value.
- **Compute-cost / hang-prevention bounds** (loop counts that invoke caller-supplied or otherwise
  unbounded-cost callbacks) — must be justified independently, ideally against a literature default
  or an existing comparable bound in the *same* risk class, never against a byte-allocation sibling's
  value.

A repeatable check: "if the unit-cost of one iteration changed, would this bound need to scale with
it?" Allocation bounds don't (bytes-per-unit is fixed and known). Compute-cost bounds implicitly
assume a worst-case callback cost that ranjs cannot verify, so the constant must absorb that
uncertainty via a conservative, externally-sourced ceiling rather than an arbitrary large round
number matched to an unrelated sibling.

This codebase has now added five such safety bounds (#916, #922, #928, #947, and #989's correction)
and will likely add more for future samplers/distributions. When planning a new numeric bound that
borrows a value from an existing constant, explicitly confirm the source constant guards the same
risk class — don't rely on code review alone to catch a mismatch, since a full 8-agent review pass
missed this one the first time around.

## Related Solutions

- `solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md` — a related but
  distinct pattern: that solution covers a sibling field *missing* a bound entirely (the same
  risk class, just not yet guarded); this one covers a sibling bound *present* but carrying the
  wrong risk class's value. Together they suggest numeric-bound additions in `src/mc/` deserve a
  two-part check: (1) are all structurally identical fields bounded? (2) does each bound's value
  come from a source in the same risk class?

## Key Insight

When copying a numeric safety-bound value from a sibling constant, verify the sibling guards the
same *risk class* (allocation footprint vs. unbounded compute-cost-per-callback) — matching risk
class is what makes the numeric value transferable, not mere proximity in the codebase or
superficial purpose similarity.
