# Compound Skill

You are documenting a solved problem so that future sessions can learn from it.

## Core Principle

Every solved problem should make future problems easier. Capture the **problem**, **root cause**, **fix**, and **prevention strategy** in a searchable format.

## Workflow

When the user invokes `/compound` or `/compound <description>`:

### 1. Gather Context

If a description is provided, use it as context. Otherwise, first sync the fresh upstream ref without touching the local `main` branch: `git fetch origin main`. Then:
- `git diff origin/main...HEAD`
- `git log origin/main..HEAD --oneline`
- Spawn the **discovery-thoughts** agent to find the related plan/research

### 2. Check for Existing Solutions

Spawn the **discovery-thoughts** agent to search for related past solutions (by category, tags,
and keywords from the diff). This runs *before* insight extraction so duplication can be judged
before a new file is drafted, not after.

Also check whether this change **supersedes** — not merely duplicates — a specific past solution:
the old file's root cause or prevention strategy is now known to be wrong, incomplete, or replaced
(as opposed to `Duplicate`, where the old file's guidance was correctly reapplied). Note the
candidate path if so; it feeds step 5's supersession step.

### 3. Extract Insight

Spawn the **ops-insight** agent with: the diff summary, commit messages, plan path (or N/A),
branch name, and the related past solutions found in step 2 (path + problem/root-cause/prevention
summary for each).

The agent returns a draft with a `confidence` field: `High`, `Duplicate`, or `Low`.

### 4. Decide Whether to Document

- **High confidence**: Proceed to step 5.
- **Duplicate confidence**: **Skip writing a new file**. If the affected code doesn't already
  reference the existing solution, add the WHY-comment link (step 6) pointing at it. Report:
  > "Compound: skipped — already covered by `solutions/<category>/<existing-file>.md`."
- **Low confidence**: **Skip silently**. Report:
  > "Compound: skipped — changes don't contain a clear, documentable insight."

Trivial changes to always skip:
- Typo fixes, formatting-only changes
- Import reordering, method reordering
- Renames with no logic change
- Comment-only additions
- A routine reapplication of an already-documented pattern with no new failure mode (this is what
  `ops-insight`'s `Duplicate` confidence flags — see above)

### 5. Write the Solution Document

Create at: `solutions/<category>/YYYY-MM-DD-HHmm-<description-slug>.md`

Categories: `distribution`, `algorithm`, `correctness`, `special-functions`, `performance`, `testing`, `tooling`

A new solution always gets `status: complete` — never set anything else at write time. Use this
format:

```markdown
---
date: <ISO timestamp>
category: "<category>"
problem: "<one-line problem summary>"
status: complete
related_issue: "<#number or N/A>"
related_plan: "<path or N/A>"
tags: [<relevant keywords>]
---

# Solution: <description>

**Date**: <timestamp>
**Category**: <category>
**Related Issue**: <#number or N/A>

## Problem

<What went wrong — symptoms, not just "file X was changed">

## Root Cause

<Why it happened — the underlying mathematical or implementation issue>

## Fix

<What was done — the approach and reasoning>

## Prevention Strategy

<How to avoid this in the future — patterns to follow, checks to add>

## Related Solutions

- <Link to related past solutions, if any>

## Key Insight

<One sentence capturing the most important takeaway>
```

If step 2 flagged a past solution as **superseded** by this one (its root cause or prevention
strategy is now wrong or incomplete — see step 2), update that older file's frontmatter in place:
set `status: superseded` and add `superseded_by: "solutions/<category>/<this-new-file>.md"`. Leave
the rest of the old file untouched — it stays as an immutable historical record, just no longer the
authoritative guidance for its topic. Stage it alongside the new file in step 7.

### 6. Link in Code

After writing the solution file, insert a reference at the most directly affected code location:

- **Function/class fix** → WHY comment at the changed line:
  ```js
  // See solutions/<category>/YYYY-MM-DD-HHmm-<slug>.md
  ```
- **Module-wide decision** → reference in the module's top comment
- Use the relative path from the repo root (grep-able)

Stage the code change together with the solution file.

### 7. Commit

```bash
git add solutions/<category>/YYYY-MM-DD-HHmm-<slug>.md <affected-file-if-linked> <superseded-file-if-any>
git commit -m "Solution compounded for #<issue> — <slug>"
```

Do **not** push here — let the caller handle pushing.

### 8. Report

> "Solution documented at:
>
> `solutions/<category>/YYYY-MM-DD-HHmm-<slug>.md`
>
> **Key insight**: <the one-sentence takeaway>"

## Rules

### DO:
- Let ops-insight decide whether the work is worth documenting
- Focus on the WHY (root cause) and the LESSON (prevention)
- Use specific, searchable tags
- Reference related past solutions when they exist

### DO NOT:
- Ask the user for input — the system decides autonomously
- Document trivial changes — skip them silently
- Write solutions that just describe the diff without insight
- Skip the prevention strategy — this is the compounding value
