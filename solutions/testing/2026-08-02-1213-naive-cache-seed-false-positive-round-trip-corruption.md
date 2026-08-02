---
date: 2026-08-02T12:13:46Z
category: "testing"
problem: "Naively seeding a verification cache produced false-positive 'generator corruption' findings"
status: complete
related_issue: "#1287"
related_plan: "thoughts/plans/2026-08-02-1022-precision-refs-continuous-regeneration-safety.md"
tags: [verification-methodology, mocking, json-float-collapse, duplicate-key, precision-refs, test-double-fidelity]
---

# Solution: Naive cache seed produced false-positive round-trip corruption

**Date**: 2026-08-02T12:13:46Z
**Category**: testing
**Related Issue**: #1287

## Problem

While verifying that `scripts/precision-refs-continuous.py --render` now regenerates
`test/precision-continuous.js` byte-identically (the core acceptance bar for issue #1287), the
first verification attempt seeded the script's throwaway reference cache
(`/tmp/precision-continuous-cache.json`) naively — a straight 1:1 dump of every on-disk `REFS`
group, extracted via `node -e` (`eval` the array, `JSON.stringify` the result).

The resulting `--render` diff was large (`120 insertions, 219 deletions` on the first pass) and
looked exactly like the fix under verification was itself corrupting data: numeric literals like
`x: 1.0` turned into `x: 1`, and the file grew from 378 to 380 groups with duplicated content for
at least one distribution. Both looked like real regressions caused by the code being tested —
neither was.

## Root Cause

Two independent gaps in the naive seeding method, both invisible until compared against the real
pipeline's structure:

1. **`JSON.stringify` collapses JS float `1.0` to `1`.** JS has one `Number` type — there is no
   way to tell JSON.stringify "this value was written as `1.0`, preserve the decimal." Every point
   value that happened to be an exact integer (`1.0`, `2.0`, `-3.0`, …) silently lost its decimal
   point on the round trip through `node -e ... JSON.stringify(...)`, before the Python generator
   ever saw the data. When `render()` re-emitted these mangled values, the diff blamed the
   generator for a formatting change the verification harness itself had introduced.

2. **Duplicate-key hand-maintained groups got double-counted.** The real cache
   (`compute_cache()`) has exactly one entry per `PARAM_SETS` key. But several distributions in
   `test/precision-continuous.js` have a **duplicate-key, hand-maintained sibling group** on disk —
   e.g. `DoublyNoncentralT[5, 5, 120]` appears twice, once as the `PARAM_SETS`-driven "main" group
   and once as a hand-added negative-x edge-case group with its own distinct tolerances. A naive
   1:1 seed feeds `render()` **two** cache entries for that one key, so `new_keys[key]` counts 2
   instead of the real pipeline's 1. `render()`'s preserve-walk logic (which decides how many
   on-disk occurrences of a key are "extra, not reproduced by the fresh cache, so preserve them
   verbatim") then sees the on-disk count exactly matched by the (artificially inflated) fresh
   count, concludes nothing needs preserving, and emits **two freshly-generated** groups for that
   key — one of which silently overwrites the hand-maintained sibling's distinct tolerances with
   the "main" group's tolerances. This looked like `render()` corrupting a duplicate-key group's
   tolerance; it was actually the seed lying about how many fresh occurrences of that key exist.

## Fix

Reseeded the cache by walking `PARAM_SETS` in its own iteration order and claiming **exactly one**
matching on-disk group per entry — using the (already-fixed) `existing_groups()` to find candidates
and the generator's own `num()` function (`repr(float(x))`) to format each point value, giving
exact formatting parity instead of routing through JS `JSON.stringify`. Genuine hand-maintained
surplus groups (duplicate-key siblings, and distributions like `TruncatedExponential` with no
`PARAM_SETS` entry at all) are left unclaimed, so they fall through to the natural preserve path —
exactly mirroring what `compute_cache()` actually produces.

Against that faithful seed, the diff collapsed from a misleading ~340-line mess to the real,
much smaller 13-group work list that `PDFCDF_TOL`/`Q_TOL`/`CDF_TOL`/`NOTES` backfill and
`PRESERVE_VERBATIM` actually needed to address.

## Prevention Strategy

When building a mock or seed input to verify that a generator or serializer round-trips its own
output, the mock must mirror the **structural invariants** of the real input it stands in for —
not just contain the same bytes. A "dump everything 1:1" seed is the naive default and will
silently violate structural invariants the real pipeline enforces elsewhere (here: one cache entry
per ordered-dict key; exact float-vs-int literal formatting), producing false positives that are
indistinguishable from the defect under investigation until someone notices the seeding method
itself is suspect.

Before trusting a verification diff as proof of a bug in the code under test, ask: could the test
harness itself be the source of the discrepancy? Two reusable red flags:
- **Any value passing through JSON serialization** — JSON collapses JS int/float distinctions;
  if the system under test cares about that distinction (as this generator's `num()` convention
  does), seed with the same formatting function the real pipeline uses, not a JSON round trip.
- **Any data model with an implicit uniqueness/cardinality constraint** (a dict keyed by X, a
  "one entry per Y" invariant) — a flat list-based seed doesn't enforce that constraint, so
  anything relying on it downstream (here: occurrence-counting preserve logic) gets fed corrupted
  cardinality and misbehaves in a way that looks like a real bug.

## Related Solutions

- `solutions/tooling/2026-07-26-2200-precision-refs-only-flag-cache-scope-not-compute-scope.md` —
  same script's cache mechanism, a different pitfall (cache-reuse scope, not seed fidelity).
- `solutions/testing/2026-08-01-2037-dnct-mu5-negx-precision-gate-conditioning-inversion.md` —
  the duplicate-key `DoublyNoncentralT[5, 5, 120]` pattern this insight's seeding bug tripped over
  was itself established by that earlier session's hand-maintained-group precedent.

## Key Insight

When mocking a cache or data store to verify a generator's round-trip fidelity, seed it by
replaying the real population logic's own key structure (e.g. one entry per `PARAM_SETS` key,
using the same value-formatting function) rather than a flat 1:1 dump of the target output — a
structurally naive seed produces false-positive "corruption" (JSON int/float collapse, duplicate-key
double-counting) that is indistinguishable from a genuine generator bug until you audit the seeding
method itself.
