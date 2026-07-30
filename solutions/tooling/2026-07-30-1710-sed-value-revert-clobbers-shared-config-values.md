---
date: 2026-07-30T17:10:02Z
category: "tooling"
problem: "An unscoped sed -i value-match/revert loop, used to empirically probe a single test group's qtol, silently corrupted ~20 unrelated groups' tolerances in a large shared test file"
status: complete
related_issue: "1207"
related_plan: "thoughts/plans/2026-07-30-1548-doubly-noncentral-t-pdf-precision-fix.md"
tags: [tooling, sed, scripted-edit, precision-continuous, review-caught, diff-hygiene]
---

# Solution: `sed -i` value-match revert clobbers unrelated shared-config entries

**Date**: 2026-07-30T17:10:02Z
**Category**: tooling
**Related Issue**: #1207

## Problem

While empirically tuning a single new precision-gate group's `qtol` value in
`test/precision-continuous.js` (a 5000+ line file with ~150 unrelated precision-gate groups) — a
bisection loop following this codebase's own documented convention of empirically-measured
tolerances (e.g. `test/precision-continuous.js`'s existing "qtol: X was measured to fail... qtol: Y
passed stably" comments) — the probing loop used `sed -i "s/qtol: 1e-9,/qtol: $q,/"` (and a
literal-string reverse of it) directly against the whole file, iterating `$q` through a set of
common "round" tolerance values (`1e-10, 5e-11, 1e-11, 5e-12, 1e-12, 5e-13`).

Because several other, unrelated distributions' groups already legitimately used those same common
values, the per-iteration "revert" step — `sed` back to `qtol: 1e-9`, matching on the *candidate
value* rather than on *which line had actually been touched this iteration* — blindly overwrote
every line in the file that transiently matched the probed value back to `1e-9`. This silently
widened the regression tolerance for ~20 unrelated distributions (`Bates`, `BetaPrime`, `Davis`,
`FisherZ`, `InverseGaussian`, `Muth`, `NoncentralChi`, `NoncentralChi2`, `R`, `Rice`, `StudentT`,
`StudentZ`, `UniformProduct`, `VonMises`, and even two *other* pre-existing `DoublyNoncentralT`
groups) to a much looser `1e-9`, with no corresponding source-code change and no `CHANGELOG.md`
mention. The `sed` commands themselves reported no error — the file was merely silently wrong.

It was caught only by two independent `/review` pipeline agents (`review-structure`,
`review-tests`), both of which flagged an unexplained blanket of `qtol` diffs spanning distributions
with no matching production-code change in the same PR — the review pipeline's own "does this diff
match the stated scope" check is what surfaced it, not any automated tooling.

## Root Cause

`sed -i` with a value-based pattern has no concept of "the specific line I changed a moment ago" —
it matches on textual content, not on edit provenance. When many independent, correct configuration
entries across a large file happen to share the same literal value (a near-certainty for "round"
tolerance numbers reused across ~150 groups in this specific file), a bisection/probing loop that
reverts by re-matching the *probed value* instead of re-matching the *specific group/line* will
indiscriminately touch every other line carrying that same value — correctly restoring the target
group while silently corrupting every incidental match elsewhere in the file. This is an inherent
hazard of shell-level global text substitution used as a scalpel: it has no locality, and unlike a
failed test or a lint error, the failure mode produces no signal at the time it happens.

## Fix

Restored `test/precision-continuous.js` from `origin/main` and re-applied only the intended
single-group change via a scoped `Edit` tool call (which requires an exact, sufficiently-unique
surrounding-context match rather than a global pattern), then verified via a plain `diff` against
the pristine `origin/main` file that the corrected diff contained only the one intended addition
before committing.

## Prevention Strategy

- Never use `sed -i` (or any global find/replace) against a large shared configuration/test file to
  tune or probe a single entry's value — especially when the value being searched for/reverted is a
  "common" number likely reused elsewhere in the file. Use a context-anchored exact-match edit (an
  `Edit`-tool-style replacement) or a `sed` invocation restricted to a specific line/address range
  instead.
- When bisecting/probing a numeric parameter empirically, structure the loop so the "revert" step
  targets the specific location edited (by line number, or by matching enough unique surrounding
  context), never by the literal value alone — the value is exactly the thing likely to collide.
- After any bulk or scripted edit to a large shared file, `diff` the result against the pristine
  base branch *before* committing, and treat a diff wider than the single intended change as a hard
  stop. This is the check that should have caught the mistake at the source, rather than relying on
  downstream review.
- "Many unrelated line-count changes with no corresponding source-code change and no changelog
  entry" is a standing red flag worth keeping in the `/review` pipeline generally — it worked here —
  but the cheaper fix is to never let a scripted edit have that blast radius in the first place.

## Related Solutions

- `solutions/tooling/2026-07-26-1630-lint-standard-glob-quoting-shell-globstar.md` — a different,
  inverse-direction shell-scripting hazard in this codebase: an unquoted glob silently
  *under*-matched (too few files linted) rather than over-matching via a shared value, but the
  common thread is the same — shell-level text/glob operations on a codebase-wide scope can fail
  silently, with no error signal, unless independently checked against the intended scope.

## Key Insight

A value-matching `sed -i` revert is not a safe undo for a value-matching `sed -i` edit: in a large
file where many independent entries legitimately share the same literal value, the "revert" clobbers
every other line carrying that value, so any scripted probing/bisection loop against shared
config or test files must scope edits by location, never by value, and should always be checked
with a `diff` against the base branch before committing.
