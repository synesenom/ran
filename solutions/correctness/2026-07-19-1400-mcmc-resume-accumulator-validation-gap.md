---
date: 2026-07-19T14:00:00Z
category: "correctness"
problem: "New MCMC resume-state fields shipped without resume-channel validation, despite the same commit's own ADR stating the rule"
status: complete
related_issue: "#1033"
related_plan: "thoughts/plans/2026-07-19-1015-mcmc-exact-stream-reproducible-resume.md"
tags: [mcmc, resume, validation, initialState, self-audit, adr-enforcement, review-caught]
---

# Solution: MCMC resume-channel accumulator validation gap

**Date**: 2026-07-19T14:00:00Z
**Category**: correctness
**Related Issue**: #1033

## Problem

Issue #1033 extended `ran.mc.MCMC.state()`/constructor to round-trip PRNG state and adaptation-batch accumulators (Robbins-Monro counters, covariance accumulator, dual-averaging state, mass-matrix accumulator) so a resumed sampler's subsequent draws are bit-for-bit identical to an uninterrupted run. The first commit (`bf99ac2`) implemented the round-trip mechanism and widened every subclass's `_internal()` to serialize these new fields — but shipped **without validating any of them** on the resume channel. Only the pre-existing `stepSize`/`pathLength`/`metric`/`prng` fields were validated; the new `daT`, `metN`, `covN`, `pAccepted`, etc. were read straight from caller-supplied `initialState.internal` with no guard. A malformed or hand-edited snapshot (e.g. `daT: -1`, `metMean` shorter than `dim`) would have been silently accepted and fed straight into the sampler's numerics, producing `NaN` or corrupted adaptation with no thrown error.

## Root Cause

This is the identical failure shape as a previously-documented bug, `solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md`: any `MCMC` field readable from both `config` (fresh construction) and `initialState.internal` (resume) needs the same validator run against both channels, but the resume channel is easy to forget because it isn't "top of mind" the way the construction channel is.

What makes this occurrence notable is that the rule was **written down twice in the same commit that violated it**: ADR-0035 (authored alongside the gap) explicitly states "every restored field must be validated on the resume channel with the same rigor as the construction channel," citing the prior solution file by path, and the implementation plan's "Learnings from Past Solutions" section quotes the identical lesson a second time. The codebase also had a live, adjacent precedent — HMC's existing `stepSize`/`pathLength` validation — sitting in the same file, right next to the new unvalidated fields. Despite the rule being written down twice and a working example sitting beside the gap, the TDD cycle for each phase produced tests for "does the field restore correctly" but not "does a malformed field throw" — because *restoring* a field and *validating* a field were treated as one task in the implementer's mental model, when the codebase's established convention treats them as two separate, always-paired obligations.

Documenting a rule in an ADR does not enforce it. Only a test (or a checklist gate independent of the author's own memory, applied at the moment a new field is added) does.

## Fix

An independent `/review` pass (the review-impact agent, running with no visibility into the ADR's stated intent) caught the gap. The fix, in a follow-up commit (`46ec224`):

1. Added four shared validators to `MCMC` (`_validateFiniteScalar`, `_validateNonNegativeInteger`, `_validateFiniteVector`, `_validateFiniteMatrix`), mirroring the existing `stepSize`/`pathLength` pattern, and called them for every newly-restored field across all six subclasses (RWM, MALA, AdaptiveMetropolis, HMC, NUTS, Slice).
2. Fixed a related bug of the *same class* discovered while writing the validators: a new helper, `HMC._resolveResumedField(resumed, key, fallback)`, used `resumed[key] || fallback` — which silently treats a legitimate `0` (e.g. a genuinely fresh `metN: 0` accumulator) as "absent" and substitutes the fallback instead. This is the same "naive channel-merging" mistake as the validation gap, just one level lower: both bugs come from writing `resume-field-handling` code without re-deriving it from the field's actual domain (can it legitimately be falsy-but-valid? does `undefined` need a distinct check from `0`?). Fixed to `resumed[key] !== undefined ? resumed[key] : fallback`.
3. Consolidated a byte-for-byte-duplicated `_restoreDualAveraging()` from HMC and NUTS into one shared base-class method (which now carries the validation calls once, not twice) — so a third dual-averaging subclass, if one is ever added, inherits the validation automatically instead of needing to remember to add it again.
4. Strengthened a test that only asserted internal-field divergence (RWM's documented `_base` mid-batch limitation) to also assert the actual draw-divergence consequence — closing a test-rigor gap of the same shape the prior HMC bug's own retrospective flagged: round-trip tests must prove the *behavioral* consequence, not just that two internal snapshot fields differ.

## Prevention Strategy

Writing a validation rule into an ADR or plan document in the same commit that violates it does not prevent the violation — it demonstrates that prose reminders don't survive contact with a single-pass implementation, because the author's blind spot when adding a field is the same blind spot that produces the missing validator. The rule needs a mechanical trigger, not a documented one.

For any future MCMC-resume-touching plan (or any `Distribution`/`MCMC` base-class change following the same `config`-vs-`initialState`-dual-channel pattern): the TDD red step for a phase that adds a new field to `_internal()`/`state()`'s restore path must include, in the same phase, a test that supplies a malformed value for *that specific field* through the resume channel and asserts it throws. This should be a standing checklist line in the plan template for any phase that touches `_internal()`, not something inferred from general "validation matters" prose — because this is the *second* occurrence of the identical gap shape in this codebase, and the first occurrence's own solution file already stated the general principle without preventing the second.

## Related Solutions

- `solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md` — the first occurrence of this exact gap shape (`stepSize`/`pathLength` validated on `config` but not `initialState.internal`), whose stated prevention rule this incident's own ADR quoted verbatim and then failed to apply to newly-added fields in the same commit.

## Key Insight

A validation rule written into an ADR in the same commit that violates it is not a safety net — the same authorial blind spot that omits the validator also omits noticing the rule applies; only a per-field "add validator + malformed-input test" checklist trigger at the moment a field is added to `_internal()`, not a prose reminder, reliably catches this recurring gap shape.
