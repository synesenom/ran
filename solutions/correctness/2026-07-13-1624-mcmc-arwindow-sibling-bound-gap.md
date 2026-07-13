---
date: 2026-07-13T16:24:35Z
category: "correctness"
problem: "MCMC.arWindow had no upper bound, unlike its sibling fields dim/maxLag, allowing an unguarded Uint8Array(arWindow) OOM allocation"
status: complete
related_issue: "#928"
related_plan: "thoughts/plans/2026-07-13-1221-mcmc-combined-dim-maxlag-bound.md"
tags: [mcmc, oom, validation, sibling-field-audit, bug-triage, joint-validator, config-defaults]
---

# Solution: MCMC arWindow sibling-bound gap found during #928 bug triage

**Date**: 2026-07-13T16:24:35Z
**Category**: correctness
**Related Issue**: #928

## Problem

`MCMC`'s constructor (`src/mc/_mcmc.js`) validates three config fields —
`dim`, `maxLag`, and `arWindow` — each feeding an unguarded array allocation
in `_initAccumulators()`: `_acBuf`/`_acCross` sized by `dim*maxLag`
(`Float64Array`), `_arBuf` sized by `arWindow` (`Uint8Array`). `dim` and
`maxLag` had each been individually capped at 10000 in prior issues (#916,
#922), but neither cap prevented a caller from supplying both at their
individual maximum simultaneously — `dim=10000, maxLag=10000` still allocated
~1.6GB from the two `Float64Array` accumulators. That was issue #928's
motivating bug.

While fixing #928, a mandatory post-implementation bug-triage pass (the
`ops-triage` agent, run between `/validate` and `/review` in the `/build`
pipeline) found that the *third* sibling field, `arWindow`, had **no upper
bound at all** — `_validateArWindow` only checked positive-integer-ness,
despite guarding `new Uint8Array(arWindow)` in the exact same
`_initAccumulators()` method. This is the identical OOM-vulnerability class
#916/#922 had already closed for `dim`/`maxLag`, just never applied to the
third structurally-identical field.

## Root Cause

`_validateDim`, `_validateMaxLag`, and `_validateArWindow` are three
structurally parallel validators (same shape: positive-integer check,
optional upper-bound check) added at different times by different issues.
Each was added independently to close a narrowly-scoped bug report —
`_validateDim`/`_validateMaxLag` got upper bounds because #916/#922
specifically asked for them — but no one revisited the *sibling* fields at
the time. A bound added to fix a *named* field does not automatically get
applied to *structurally identical but unnamed* fields; that requires an
explicit audit step, not just fixing what the triggering issue literally
asked for.

A secondary, smaller issue surfaced during design-critique of the fix itself:
the first draft of the new joint `_validateCombinedFootprint(dim, maxLag)`
validator resolved `undefined` dim/maxLag to their defaults *inside* the
validator (mirroring `_resolveConfig`'s `config.dim || 1` logic), which would
have created a second copy of that default-filling logic that could silently
drift out of sync if the defaults were ever changed in one place but not the
other.

## Fix

1. Added `_validateCombinedFootprint(dim, maxLag)` as a fourth static
   validator in `src/mc/_mcmc.js`, called in the constructor *after*
   `_resolveConfig` has filled in defaults — i.e. operating on the resolved
   `this.dim`/`this.maxLag`, not raw `config.dim`/`config.maxLag`. This
   avoids duplicating `_resolveConfig`'s default-filling logic.
2. During bug triage, patched the missing `arWindow` bound inline in the
   same branch: added `_MAX_AR_WINDOW = 10000` and the missing upper-bound
   check in `_validateArWindow`, mirroring the existing
   `_validateDim`/`_validateMaxLag` pattern exactly. Extended the same
   `test/mc.js` boundary-test pattern (`arWindow: 1e9`/`10001` throws,
   `arWindow: 10000` doesNotThrow) and folded the fix into the existing
   `#916, #922, #928` CHANGELOG bullet rather than filing a separate issue,
   since it was a trivial, same-class, same-file fix caught by triage
   (`ops-triage` returned `definite`, `fix_inline: true`).

## Prevention Strategy

When a PR adds or tightens a bound on one field among several structurally
parallel sibling fields (same validator shape, same class of
allocation-guard purpose), explicitly audit whether every sibling has an
equivalent bound — not just the field(s) the triggering issue named. This
audit is cheap (grep for the validator pattern, check which ones have an
upper-bound branch) and is exactly the kind of adjacent-red-flag check the
mandatory bug-triage stage is designed to catch; this instance is a working
example of that stage doing its job, not an argument that it should be
skipped.

Separately: when adding any *joint/derived* validator over multiple
already-independently-validated fields, run it on the already-resolved
(post-default-fill) values rather than raw config — resolving defaults a
second time inside the joint validator creates a duplicate copy of the
resolution logic that can silently drift if the defaults are ever changed in
one place but not the other.

## Related Solutions

No related past solutions found (`#916`/`#922`, the two prior individual
`dim`/`maxLag` bounds, have no dedicated solution documents — their
rationale lives only in inline code comments and the CHANGELOG bullet this
work extends).

## Key Insight

When hardening one field against unbounded allocation, treat every
structurally identical sibling field (same validator shape, same class of
allocation it guards) as in-scope for the same audit — the bug-triage stage
exists precisely to catch this "fixed the named field, missed the identical
unnamed one" pattern, as it did here for `arWindow` sitting unbounded next
to the two fields #916/#922 had already hardened.
