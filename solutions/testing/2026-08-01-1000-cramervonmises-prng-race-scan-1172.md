---
date: 2026-08-01T10:00:00Z
category: "testing"
problem: "cramerVonMises test/test.js case intermittently failed under `npm test` (mocha --parallel) but passed reliably in isolation"
status: complete
related_issue: "#1172"
tags: [testing, prng, seeding, flaky-test, mocha-parallel, cramer-von-mises]
---

# Solution: cramerVonMises flakiness was un-seeded Distribution sampling, not a mocha-parallel race

**Date**: 2026-08-01T10:00:00Z
**Category**: testing
**Related Issue**: #1172

## Problem

`test/test.js`'s `cramerVonMises > should pass for samples drawn from the tested distribution` case
intermittently failed when the full suite ran via `npm test` (`mocha --parallel`), but passed
reliably every time when run in isolation (`npx mocha test/test.js`). The issue asked to confirm
whether this was a race in the module-level PRNG's mutable state leaking across `mocha --parallel`
worker processes, or a test-ordering sensitivity, and to scan all tests using the same
`seed()`/`float()`/`int()` pattern (`src/core/index.js`) for the same risk.

## Root Cause

Not a cross-worker race. The test called `seed(0)` — which only reseeds the module-level singleton
generator behind `float()`/`int()` (`src/core/index.js`) — and then drew its sample from a fresh
`Normal` instance via `.sample()` *without* seeding that instance. `Distribution` subclasses each own
a private `Xoshiro128p` (`src/dist/_distribution.js`) that self-seeds from `Math.random()` unless
`.seed()` is called on it directly. So the drawn sample, and therefore the Cramér-von Mises statistic
computed from it, was non-deterministic on **every** run — serial or parallel, isolated or full-suite.
`mocha --parallel` didn't cause the flakiness; it just increased the chance of the run landing on one
of the rare samples whose statistic exceeds the test's rejection threshold, since the full suite
exercises the test only once per `npm test` invocation same as isolation, but CI's higher run volume
surfaced the rare tail more often.

The fix (already applied on `main` in commit `8f03f439`, "Flaky cramerVonMises test stabilized with
instance seeding") chains `.seed(0)` directly on the `Normal` instance before `.sample()`, making the
draw deterministic regardless of scheduling.

## Scan for the same pattern

Six test files import the module-level generators (`grep -rn "from '../src/core'" test/*.js`):
`test/ad.js`, `test/core.js`, `test/dist-base-special-cases.js`, `test/location.js`,
`test/test-anderson-darling.js`, `test/test.js`. Every `.sample()` call across all six was checked for
whether it runs on an instance that both (a) is unseeded and (b) has an assertion sensitive to the
exact draw (as opposed to a statistical property robust to any draw, e.g. a Type-I-error rejection
rate or a Wilson-interval bound):

- `test/ad.js`, `test/core.js`: never call `Distribution.sample()` — they exercise the module-level
  `float()`/`int()` generators directly, seeding immediately before consuming them within the same
  synchronous `it()` block. Safe: no separate un-seeded generator is involved.
- `test/test-anderson-darling.js`: every `Distribution` instance that calls `.sample()` already chains
  or calls `.seed(...)` beforehand.
- `test/location.js:184`, `test/dist-base-special-cases.js` (DoublyNoncentralF regression block):
  already seeded (`.seed(0)`, `.seed(123456789)`).
- `test/dist-base-special-cases.js:144` (`Degenerate.sample(10)`): unseeded, but `Degenerate` always
  returns its fixed `x0` regardless of the underlying generator's state, so no assertion is sensitive
  to randomness — not flaky by construction.
- `test/test.js`: all other `.sample()` call sites (bartlett, brownForsythe, levene, hsic,
  kolmogorovSmirnov, mannWhitney, welch blocks) already chain `.seed(i)`/`.seed(n)` on the instance.
  The `cramerVonMises` "should pass"/"should reject" cases were the only two missing it, and both are
  fixed in `8f03f439`.

No other test shares the un-fixed risk pattern.

## Verification

- `npx mocha --require @babel/register test/test.js --grep cramerVonMises`: 5 consecutive isolated
  runs, all 7 cases passing.
- `npm test` (full suite, `mocha --parallel`): 2 consecutive full cycles, 9619 passing, coverage
  thresholds met, exit code 0 both times.

## Prevention

The instance-seeding requirement is now called out inline at the fix site
(`test/test.js:174-177`) so future tests constructing a `Distribution` and asserting on an exact
statistic remember that the module-level `seed()` does not reach the instance's own generator.
