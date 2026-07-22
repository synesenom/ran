---
date: 2026-07-22T07:02:29Z
category: "tooling"
problem: "A session resume silently reverted uncommitted working-tree changes to an earlier checkpoint mid-task"
status: complete
related_issue: "#1063"
related_plan: "N/A"
tags: [session-resume, uncommitted-work, git-checkpoint, commit-early, data-loss]
---

# Solution: session resume silently reverted uncommitted work mid-task

**Date**: 2026-07-22T07:02:29Z
**Category**: tooling
**Related Issue**: #1063

## Problem

Mid-session while implementing the fix for #1063, a `SessionStart:resume` hook fired (the environment resumed after being paused). After the resume, `git diff --stat` showed a much smaller diff than expected — the custom `static fit()` override, the strengthened regression test, and the `CHANGELOG.md` entry were all missing from disk. Only an earlier, already-superseded version of the fix (the backward-loop cap alone) remained. Nothing in the conversation indicated any of this work had been undone; the assistant's own recollection of having written and verified those changes was accurate, but the on-disk state did not reflect it.

## Root Cause

The container/session environment appears to snapshot and restore working-tree state around pause/resume boundaries. A resume landed on a snapshot taken before the later edits were made, discarding uncommitted working-tree changes made after that checkpoint — even though the conversation transcript (and the assistant's context) continued seamlessly across the resume as if no time had passed. Uncommitted changes are not a durable unit in this environment; only committed (and especially pushed) state reliably survives a resume.

## Fix

The lost changes were re-derived and reapplied directly from what had already been established earlier in the same conversation (the exact `fit()` override code, test assertions, and changelog wording were still fully known), without needing to redo any of the empirical investigation. The discrepancy was caught only because a routine `git diff --stat` check before finishing a validation pass showed an unexpectedly small diff — a smaller, unrelated verification step incidentally caught a much larger problem.

After recovering the lost work, the practice adopted for the remainder of the session was to commit (and push) as soon as a coherent, verified unit of work existed, rather than batching many changes before committing — e.g., committing immediately after the fix passed its targeted test, rather than waiting until the full `/build` pipeline's later "ship" stage.

## Prevention Strategy

- **Commit early and often when working across a long or resumable session**, especially once a change has been verified (tests pass) — don't wait for a pipeline's designated "ship" stage to create the first durable checkpoint. A local commit costs nothing and can always be amended, squashed, or reordered later; uncommitted work has no such guarantee in an environment that can snapshot/restore around pauses.
- **Push, not just commit, when the risk is a full environment/container reset** (not just a working-tree revert) — a local-only commit still lives in the same filesystem that got reverted; pushing to the remote is what survives an environment-level rollback.
- **Don't trust "I remember doing X" as proof X is still on disk** after any session pause/resume boundary. Re-verify with a cheap, concrete check (`git diff --stat`, `git log --oneline -1`, or grepping for a known marker string) before proceeding to a later pipeline stage (validation, review, shipping) that assumes the work is present.
- If a discrepancy is found, don't assume it's safe to just re-run the whole prior investigation — check whether the actual PRODUCT of that investigation (the specific code/text changes) is still fully known from conversation context, and reapply it directly; only fall back to redoing the underlying investigation if the reasoning itself, not just its output, was lost.

## Related Solutions

None found for this specific failure mode in this repository's `solutions/` directory as of this writing.

## Key Insight

In an environment where pause/resume can silently revert uncommitted working-tree state, a local commit (and ideally a push) is the only durable checkpoint — treat "tests pass" as the signal to commit immediately, not as a milestone to accumulate toward a later batch commit.
