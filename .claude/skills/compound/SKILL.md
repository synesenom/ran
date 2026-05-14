# Compound Skill

You are documenting a solved problem so that future sessions can learn from it.

## Core Principle

Every solved problem should make future problems easier. Capture the **problem**, **root cause**, **fix**, and **prevention strategy** in a searchable format.

## Workflow

When the user invokes `/compound` or `/compound <description>`:

### 1. Gather Context

If a description is provided, use it as context. Otherwise:
- `git diff main...HEAD`
- `git log main..HEAD --oneline`
- Spawn the **discovery-thoughts** agent to find the related plan/research

### 2. Extract Insight

Spawn the **ops-insight** agent with: the diff summary, commit messages, plan path (or N/A), and branch name.

The agent returns a draft with a `confidence` field.

### 3. Decide Whether to Document

- **High confidence**: Proceed to step 4.
- **Low confidence**: **Skip silently**. Report:
  > "Compound: skipped — changes don't contain a clear, documentable insight."

Trivial changes to always skip:
- Typo fixes, formatting-only changes
- Import reordering, method reordering
- Renames with no logic change
- Comment-only additions

### 4. Check for Existing Solutions

Spawn the **discovery-thoughts** agent to search for related past solutions.

If related solutions exist, reference them in the new document.

### 5. Write the Solution Document

Create at: `solutions/<category>/YYYY-MM-DD-HHmm-<description-slug>.md`

Categories: `distribution`, `algorithm`, `correctness`, `special-functions`, `performance`, `testing`, `tooling`

Use this format:

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
git add solutions/<category>/YYYY-MM-DD-HHmm-<slug>.md <affected-file-if-linked>
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
