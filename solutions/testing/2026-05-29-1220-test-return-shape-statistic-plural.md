---
date: 2026-05-29T12:20:00Z
category: "testing"
problem: "README documented test() returning { statistic } (singular) but actual return is { statistics } (plural)"
status: complete
related_issue: "#503"
related_plan: "thoughts/plans/2026-05-29-1205-fit-showcase-docs.md"
tags: [docs, readme, test, return-shape, statistics, jsdoc, correctness]
---

# Solution: test() return shape documented incorrectly as { statistic } instead of { statistics }

**Date**: 2026-05-29T12:20:00Z
**Category**: testing
**Related Issue**: #503

## Problem

The README contained a code example showing `skellam.test(values)` returning `{ statistic: 14.025…, passed: true }` (singular `statistic`). The actual method returns `{ statistics: number, passed: boolean }` (plural). This error was undetected because README examples are prose, not executable code. When a new docs page (`parameter-estimation.pug`) was drafted reusing the same return-value comment pattern, the wrong key would have been propagated to a second location.

## Root Cause

The JSDoc `@returns` on `Distribution.test()` in `src/dist/_distribution.js:731` clearly documents `{ statistics, passed }` and the inline example at line 745 shows `{ statistics: 0.086…, passed: true }`. The README was written independently, using the intuitively natural singular form `statistic` without verifying against the source. Because the README contains no runnable assertions, the discrepancy survived until a new author needed to copy the pattern.

## Fix

During the review pass of PR #503, the return shape was verified against the JSDoc `@returns` in `_distribution.js`. This surfaced the pre-existing error. Two fixes were applied:

1. `README.md` (Skellam usage example): `{ statistic: 14.025… }` → `{ statistics: 14.025… }`
2. `README.md` (new parameter-estimation section): `{ statistic: … }` → `{ statistics: … }`
3. `docs/templates/parameter-estimation.pug`: written with the correct key from the start.

## Prevention Strategy

Before writing any code example in documentation that shows a method return value, grep the `@returns` JSDoc on that method in the source and confirm the exact property name:

```bash
grep -A3 "@returns" src/dist/_distribution.js | grep -i "statistic\|passed"
```

For `Distribution` methods, `_distribution.js` is the canonical source — do not trust existing README examples, which may carry uncorrected prose errors. A doc-test runner (e.g., `jsdoc-testify`, `doctest`) would catch this class of error automatically, but even a manual cross-check prevents propagation.

## Related Solutions

No directly related past solutions found.

## Key Insight

`Distribution.test()` returns `{ statistics, passed }` with `statistics` plural — verify return shapes against the JSDoc `@returns` in `src/dist/_distribution.js` before writing any prose example, since README and Pug docs are not executable and cannot self-correct.
