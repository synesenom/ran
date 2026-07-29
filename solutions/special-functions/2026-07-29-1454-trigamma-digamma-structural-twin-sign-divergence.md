---
date: 2026-07-29T14:54:35Z
category: "special-functions"
problem: "Adding trigamma by mirroring digamma.js's file layout risked silently copying the wrong signs/algebraic shape"
status: complete
related_issue: "#1141"
related_plan: "thoughts/plans/2026-07-29-1405-add-trigamma.md"
tags: [trigamma, digamma, polygamma, stirling-series, reflection-formula, recurrence, structural-twin]
---

# Solution: structural resemblance between special functions does not imply shared signs

**Date**: 2026-07-29T14:54:35Z
**Category**: special-functions
**Related Issue**: #1141

## Problem

`trigamma` (ψ1, polygamma order 1) was added to `src/special/` as a near-exact structural
mirror of the existing `digamma.js`: both are a Stirling asymptotic series, a shift-and-sum
recurrence for small arguments, a reflection formula for negative arguments, and an
ADR-0015 `Infinity` pole guard. That four-part skeleton is exactly the kind of resemblance
that invites copy-adapt-and-move-on — and exactly the situation where a plausible-looking
but numerically wrong implementation slips through, because the code *shape* matches while
the *math* underneath does not.

## Root Cause

Three of the four ingredients differ from digamma in ways that are easy to get backwards:

- **Recurrence sign is reversed.** Digamma's recurrence `ψ(z+1) = ψ(z) + 1/z` is walked
  upward by *subtracting* (`digamma.js`: `s = s - 1/z`). Trigamma's recurrence
  `ψ1(z+1) = ψ1(z) - 1/z²` must be walked upward by *adding* (`s = s + 1/z²`). Reusing
  digamma's `-` would silently flip the sign of every shifted value.
- **Reflection formula is a different algebraic shape, not just different constants.**
  Digamma's is a *difference* equal to a `cot` term: `ψ(z) = ψ(1-z) - π·cot(πz)`. Trigamma's
  is a *sum* equal to a `csc²` term: `ψ1(1-z) + ψ1(z) = π²/sin²(πz)`. Solving for
  `trigamma(z)` requires rearranging the sum (`trigamma(z) = π²/sin²(πz) - trigamma(1-z)`);
  it cannot borrow digamma's subtraction shape.
- **The two `coeffs` arrays look identical in structure but differ in meaning.** Digamma's
  stores `|B_2k/(2k)|` and relies on a specific sign-alternation trick baked into its Horner
  loop (`s = (coeffs[i] - s) / z2`). Trigamma's coefficients are the Bernoulli numbers
  `B_2..B_12` directly (`1/6, -1/30, 1/42, -1/30, 5/66, -691/2730`), with the alternating
  sign already present in the literals, evaluated by a differently-signed Horner recurrence
  (`p = coeffs[i] + p / z2`). Treating them as interchangeable — e.g. copying digamma's
  `coeffs` array and loop verbatim — would produce a wrong series with the wrong sign
  pattern.

## Fix

Each ingredient was independently re-derived from trigamma's own definition (Wikipedia
"Trigamma function", cross-checked against the differentiated digamma Stirling series) and
verified against mpmath (`mp.dps=50`) and closed-form identities (`ψ1(1) = π²/6`,
`ψ1(1/2) = π²/2`, `ψ1(1/4) = π² + 8G`), rather than copied from `digamma.js` and patched
until tests passed. The plan (`thoughts/plans/2026-07-29-1405-add-trigamma.md`) flagged all
three divergences as risks before implementation began, and `src/special/trigamma.js`
carries WHY-comments at each divergence point (e.g. the `coeffs` array comment states
explicitly that trigamma's coefficients "carry their sign directly... unlike digamma's
series"). Self-consistency tests — a recurrence-identity sweep and a reflection-formula
identity check computed independently of the SUT — were written first (TDD) and would have
failed loudly on a sign error, before any mpmath dependency was even needed.

## Prevention Strategy

When implementing a new function in a family by structurally mirroring an existing sibling
file (digamma → trigamma, any future higher-order polygamma, or any "this looks like an
existing pattern" special function or distribution), treat the file layout as scaffolding
only. Explicitly enumerate every mathematical ingredient the sibling encodes — recurrence
sign, reflection/symmetry formula shape, series coefficients, threshold/crossover point —
and re-derive or independently verify each one against an external source (mpmath, DLMF,
Wikipedia closed forms) before trusting it. Do not assume a sign or algebraic shape carries
over just because the surrounding code skeleton does. Write self-consistency tests
(recurrence identity, reflection identity checked from both branches) before the
mpmath-sourced precision gate — they are cheap and fail fast on exactly this class of bug.

## Related Solutions

None found specifically for the digamma/trigamma or polygamma family in this repository's
`solutions/` directory as of this writing.

## Key Insight

Structural resemblance between two special functions (same code skeleton: series →
recurrence → reflection → pole guard) does not mean the signs, algebraic shapes, or
coefficient semantics are shared — verify each mathematical ingredient independently
against an external source even when copying the file layout of a near-identical sibling.
