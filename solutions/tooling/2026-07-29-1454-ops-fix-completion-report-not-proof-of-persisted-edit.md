---
date: 2026-07-29T14:54:35Z
category: "tooling"
problem: "An ops-fix subagent's detailed completion report claimed a file edit that was never actually persisted to disk"
status: complete
related_issue: "#1141"
related_plan: "N/A"
tags: [ops-fix, review, subagent, verification, git-diff, trust-but-verify]
---

# Solution: a subagent's narrative completion report is not proof of a persisted edit

**Date**: 2026-07-29T14:54:35Z
**Category**: tooling
**Related Issue**: #1141

## Problem

During the `/review` auto-fix stage for issue #1141 (adding `trigamma` to `src/special/`),
an `ops-fix` subagent was dispatched to document a near-pole precision caveat in a test
comment. It returned a detailed completion report: a specific rewritten comment, a
re-verification of the two existing hardcoded reference values via
`python3 scripts/precision-refs-special.py --check`, and a final `npm run standard && npm
test` pass with an exact passing count. Immediately after receiving that report, a routine
`git diff` check (prompted by an unrelated stop-hook nudge to commit) showed the file
completely unchanged from before the agent ran — the claimed comment rewrite was simply not
on disk.

## Root Cause

A subagent's natural-language completion report is generated independently of whether its
tool calls actually persisted. Nothing in the reporting channel guarantees the two are
consistent — a model can produce a specific, plausible-sounding narrative (complete with
verification numbers and command output) regardless of whether the underlying `Edit`/`Write`
call actually succeeded, was silently dropped, or was made against a stale or since-reverted
copy of the file. Specificity and internal consistency in a report are not evidence that it
describes reality; they are exactly the property a well-calibrated model's output naturally
has, whether or not the described action happened.

## Fix

The orchestrating session did not act on the subagent's report directly. It re-checked
`git diff` immediately after the completion notification, confirmed the claimed change was
absent from `src/special/trigamma.js`'s test file, and redid the fix directly rather than
building further work (a commit, a push, or a later pipeline stage) on top of an unverified
claim. A second, larger `ops-fix` invocation later in the same session (three combined test
coverage gaps) was held to the identical standard — its changes were independently verified
via `git diff`, `grep` for the new grid rows, and a fresh test/lint run *before* being
committed, and in that case verification confirmed the changes were genuinely present.

## Prevention Strategy

Never treat a subagent's (or any agent's) narrative completion report as proof that a file
change was persisted, no matter how detailed or specific it sounds — treat it as a claim to
verify, not a fact to build on. After any agent claims to have made an edit, check `git
diff`, `grep` for the expected change, or re-read the file before relying on it: committing
it, pushing it, or launching further work on top of it. This check is nearly free relative
to the cost of silently shipping an unresolved review finding or building subsequent
implementation work on a phantom fix. This generalizes beyond `/review`'s `ops-fix` agent to
any pipeline stage (`/hotfix`, `/build`, `/implement`, `/fix`) that dispatches subagents to
edit files and then proceeds based on their self-reported status.

## Related Solutions

- `solutions/tooling/2026-07-22-0702-session-resume-reverted-uncommitted-work.md` — a
  related but distinct failure mode: there, a session-resume snapshot silently reverted
  already-verified working-tree changes with no subagent involved, and the fix was to commit
  early rather than trust "I remember doing X." This solution extends the same underlying
  lesson ("don't trust memory/reports over on-disk state") to a different root cause: a
  subagent's own completion narrative diverging from what its tool calls actually persisted,
  within a single uninterrupted session with no resume/pause boundary.

## Key Insight

A subagent's detailed, confident completion narrative is not evidence that its file edit
was persisted — always re-verify via `git diff`/`grep` against the actual repository state
before trusting or building on top of a reported fix, no matter how specific the report
sounds.
