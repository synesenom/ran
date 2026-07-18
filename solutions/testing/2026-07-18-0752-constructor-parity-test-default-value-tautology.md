---
date: 2026-07-18T07:52:34Z
category: "testing"
problem: "A constructor-form parity test using only default config values can't catch a resolver silently dropping a field"
status: complete
related_issue: "#966"
related_plan: "thoughts/plans/2026-07-18-0600-hmc-options-object-constructor.md"
tags: [mcmc, constructor-parity, options-object, test-tautology, hmc, rwm, slice, adaptive-metropolis]
---

# Solution: constructor-form parity test default-value tautology

**Date**: 2026-07-18T07:52:34Z
**Category**: testing
**Related Issue**: #966

## Problem

Migrating `HMC`'s constructor to the options-object form (ADR-0031, extending ADR-0030's
`RWM`/`Slice`/`AdaptiveMetropolis` work) needed a test proving the new
`MCMC._resolveGradientSamplerArgs` resolver forwards every field (`stepSize`, `pathLength`,
`metric`) from the options object exactly as the positional form does. The first draft of the
parity helper, `assertGradientConstructorFormsMatch`, was called with only `{ dim: 1 }` as its
config override — mirroring the exact call shape already used by the three already-shipped
sibling tests (`assertConstructorFormsMatch(RWM, ..., { dim: 1 }, ...)` at `test/mc.js:495`, the
equivalent `AdaptiveMetropolis` block at `test/mc.js:706-719`, and `Slice`'s block at
`test/mc.js:2231`).

A `review-tests` agent caught that this test would still pass even if the resolver silently
dropped `stepSize`/`pathLength`/`metric` from the options object entirely — because both the
"positional" and "options" instances being compared would fall back to `HMC`'s own hard-coded
defaults (`stepSize: 0.1`, `pathLength: 10`, `metric: 'diag'`) regardless of whether the resolver
actually threaded the fields through.

## Root Cause

A parity/round-trip test ("does calling convention A produce the same result as calling
convention B?") only proves a specific field is forwarded correctly if the test's value for that
field differs from what the code would produce with the field entirely absent. `{ dim: 1 }` is
`MCMC`'s own default for `dim` — so every one of the four MCMC-family parity tests that use it
(`RWM`, `Slice`, `AdaptiveMetropolis`, and `HMC`'s first draft) proves nothing about whether `dim`
itself is actually threaded through the options object; two sides landing on the same default
value looks identical whether or not the resolver ever read the field. Reusing the same
minimal/canonical example config across a family of near-identical tests — done for brevity and
consistency across sibling classes — silently turns the assertion into a tautology for every field
left at its default, and the bug class the test exists to catch (a resolver that drops a key)
becomes invisible.

## Fix

For `HMC`, a second `assertGradientConstructorFormsMatch` case was added using non-default
`stepSize: 0.3`, `pathLength: 7`, and `metric: 'dense'` (`test/mc.js`), so the `state().internal`
comparison inside the helper is forced to depend on correct field-by-field resolution rather than
two copies of the same default. The fix was scoped to `HMC` only for this issue — it was **not**
backported to `RWM`/`Slice`/`AdaptiveMetropolis`'s pre-existing parity tests, which have the
identical gap (`test/mc.js:494-496`, `:704-719`, `:2228-2232` all still use only `{ dim: 1 }`). A
follow-up issue was filed to backport non-default-value cases to those three.

## Prevention Strategy

- Any constructor/API "parity" test that compares two equivalent call forms must use at least one
  non-default value for every field under comparison. A config value identical to that field's own
  default proves nothing about correct forwarding — it only proves both code paths eventually reach
  the same fallback.
- When a review agent (or a human) catches a test-coverage gap in one instance of a repeated
  cross-file pattern (here: a shared assertion helper reused across sibling classes —
  `assertConstructorFormsMatch`/`assertGradientConstructorFormsMatch`), treat it as a signal to
  audit every other call site of that same pattern, not just the file under review. The same gap is
  highly likely to be latent in siblings implemented earlier under the same convention, since they
  were written before the gap was known — as confirmed here for `RWM`/`Slice`/`AdaptiveMetropolis`.
- When writing a shared test helper intended to be reused by future siblings (`MALA`/`NUTS` will
  need their own gradient-sampler parity tests next), bias its example call sites toward
  non-default values from the start, since later copy-paste calls tend to imitate the first
  example's shape.

## Related Solutions

- `solutions/testing/2026-07-16-1600-mala-log-scale-storage-strict-equal-trap.md` — a different
  MCMC constructor-parity pitfall (log-scale-stored `stepSize` needs `closeTo`, not
  `strictEqual`), relevant to `MALA`'s own future migration reusing this same parity-helper
  pattern.
- `solutions/testing/2026-07-17-1615-mcmc-ks-test-seed-sweep-file-wide-policy.md` — a different
  file-wide MCMC test convention (fixed seed sweeps for statistical tests), same file
  (`test/mc.js`), same "audit every call site of a shared convention" prevention lesson.

## Key Insight

A parity test only proves a resolver forwards field X correctly if the test's expected value for X
differs from what the code would produce with X entirely absent — three already-shipped MCMC
constructor-parity tests (`RWM`, `Slice`, `AdaptiveMetropolis`, all using `{ dim: 1 }`, which equals
`dim`'s own default) still have exactly this blind spot, caught only while writing `HMC`'s new test
and not yet backported to its siblings.
