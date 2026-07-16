---
date: 2026-07-16T14:00:00Z
category: "correctness"
problem: "GitHub issue #830's own spec stated a reversed (mathematically wrong) Parallel Tempering swap-acceptance formula"
status: complete
related_issue: "#830"
related_plan: "thoughts/plans/2026-07-16-1230-parallel-tempering-sampler.md"
tags: [mcmc, parallel-tempering, detailed-balance, spec-error, tdd, ks-test]
---

# Solution: Parallel Tempering swap formula — the issue spec, not the code, was wrong

**Date**: 2026-07-16
**Category**: correctness
**Related Issue**: #830

## Problem

Issue #830 asked for a Parallel Tempering (Replica Exchange MCMC) sampler and stated the swap-acceptance formula as:

```
min(1, exp((β_i − β_i+1)(log p(x_i) − log p(x_i+1))))
```

Implementing this literally passed every unit test (constructor validation, swap counting, ladder generation) but failed a bimodal-target KS test built during TDD: the cold (β=1) replica's within-mode variance came out inflated to ~1.38 against a true value of 1.0 — a systematic, directionally-consistent bias, not test flakiness. The code matched the issue's spec exactly; the spec itself encoded the wrong ratio.

## Root Cause

The issue's formula had the two log-density terms transposed relative to what detailed balance on the joint replica distribution `Π(x_1,...,x_n) = ∏_k p(x_k)^{β_k}` actually requires. Swapping replica i's position `a` with replica i+1's position `b` changes `Π` by a factor `exp[(β_i − β_i+1)(log p(b) − log p(a))]` — the *incoming* position's log-density must come first, not the *current* one's. The issue's stated formula was the reciprocal of the correct acceptance ratio, which biases swaps in the wrong direction.

## Fix

Independently re-derived the acceptance ratio from first principles via three convergent methods — a general symbolic derivation on the joint distribution, a careful position-relabeling check, and a discrete 2-state toy model — all agreeing on:

```
min(1, exp((β_i − β_i+1)(log p(x_i+1) − log p(x_i))))
```

Implemented the corrected formula in `src/mc/parallel-tempering.js`'s `_proposeSwap`, which resolved the KS test failure (cold-chain std converged to ~1.0–1.03 across 3 fixed seeds). Documented the correction in three places, since the issue's own body — not any existing code — was the source of the error: an inline WHY-comment on `_proposeSwap`, ADR-0028 (Context and Decision sections both record the derivation, not just the discrepancy), and a comment posted back on issue #830 itself so future readers of the issue aren't misled by its original text.

## Prevention Strategy

When a TDD red-test failure on a *statistical/distributional* algorithm shows a **systematic, directional bias** — variance consistently inflated/deflated, not the noisy/occasional pattern typical of an off-by-one or edge-case bug — treat "the spec might be wrong" as a live hypothesis alongside "my implementation is wrong," especially when the formula in question can be independently re-derived from a first-principles invariant (here: detailed balance on the full joint distribution).

Concretely:
- A spec quoted in a GitHub issue is not a proof. Issues, unlike papers, are not peer-reviewed — a plausible-looking formula can still have transposed terms, flipped signs, or reciprocal ratios.
- Before concluding the spec is wrong, cross-check any re-derivation with **at least two independent methods** (e.g., a general symbolic derivation plus a minimal toy-model instance with concrete numbers). The cost of wrongly overriding a correct spec is high (a silent, undetected regression that "looks right" until scrutinized); the cost of the extra derivation is low.
- Once confirmed, document the correction where three different future readers will each find it: inline in the code (why this formula, not the literal spec), in the ADR/design record (the full derivation, for anyone auditing the design), and on the originating issue itself (so the issue's text doesn't keep misleading people after the PR merges).

## Related Solutions

No directly related past solutions found — existing correctness solutions in this repo (`solutions/correctness/`, `solutions/special-functions/`) are about numerical-reference mismatches (scipy/mpmath conventions, cancellation, convergence crossovers), not about an issue's own stated formula being wrong. This is a distinct failure mode: a first-principles derivation error in the *spec*, not a numerical-precision error in the *implementation*.

## Key Insight

A statistical-sampler correctness test failing with a systematic (not noisy) bias is a strong signal to independently re-derive the governing formula from first principles rather than assume the bug is in the code — the issue/spec itself can be the source of a directionally-wrong but superficially plausible formula.
