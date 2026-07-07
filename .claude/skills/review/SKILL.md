# Review Command

You are performing a pre-commit code review of the current branch's changes against `main`.

## Core Principle

Catch issues that CI cannot: spec deviations, mathematical errors, over-engineering, and convention violations. Do not duplicate what linting and tests already enforce.

## Workflow

When the user invokes `/review`:

### 1. Gather Context

Run these commands in parallel:

- `git branch --show-current` — get current branch name
- `git diff main...HEAD` — full diff of all changes
- `git diff` — any unstaged changes
- `git diff --staged` — any staged changes
- `git log main..HEAD --oneline` — list of commits on this branch

If the branch is `main`, stop: "You're on main. Switch to a feature branch first."
If there are no changes, stop: "Nothing to review — no changes found."

### 2. Load the Plan (if one exists)

Spawn the **discovery-thoughts** agent to find a related plan for the current branch.

If a plan is found, read it — this is the spec for Pass 1. If no plan exists, skip Pass 1 and note it in the report.

### 3. Pass 1 — Spec Compliance

Compare the diff against the plan and check:

- **Completeness**: Were all planned steps implemented?
- **Faithfulness**: Does the implementation match the plan's approach?
- **Leftovers**: Debug prints, TODOs, commented-out code?
- **Scope**: Changes made outside the plan's scope?

### 4. Pass 2 — Code Quality (Parallel Subagents)

**CRITICAL: Launch exactly 11 review agents. Verify all 11 returned results before proceeding.**

Save the diff to a temporary file:
```bash
mkdir -p .claude/tmp && git diff main...HEAD > .claude/tmp/review-diff-$(git branch --show-current).patch
```

Then launch all eleven **in a single parallel call**, telling each to read `.claude/tmp/review-diff-<branch-name>.patch`:

- **review-security** agent
- **review-performance** agent
- **review-simplicity** agent
- **review-tests** agent
- **review-docs** agent
- **review-correctness** agent
- **review-logic** agent — general code logic bugs (inverted conditions, null deref, wrong variable)
- **review-removals** agent — dropped guards, removed invariants, deleted tests covering real behavior
- **review-callers** agent — cross-file caller impact of changed function signatures
- **review-altitude** agent — bandaid fixes layered on shared infrastructure instead of generalizing
- **review-conventions** agent — CLAUDE.md rule violations, with exact rule quotes

Each agent returns `Block` findings (must fix before commit), `Warn` findings (real problem, file as issue), or `No issues found.`

Wait for all eleven. Then:
1. Collect every `Block` and `Warn` line from all agents.
2. Deduplicate: if two agents flag the same file:line for the same root cause, keep one and tag it with both domains (e.g. `[logic, correctness]`).
3. Produce one flat merged list — `Block` items first, then `Warn` — each tagged with its source domain.

### 5. Generate Report

> **Review: `<branch name>`**
>
> **Spec**: PASS | FAIL | SKIPPED (no plan found)
> <If FAIL: bulleted list of spec gaps>
>
> **Block (<N>):**
> - [ ] `[domain]` file:line — description and fix
>
> **Warn (<N>):**
> - [ ] `[domain]` file:line — description and recommendation
>
> **Verdict**: PASS | FAIL (<N> to fix before commit, <M> to file)

Verdict is FAIL if there are any Block items. Warn items do not block — they should be filed as issues after committing. If both Block and Warn are empty, output `Verdict: PASS` with no lists.

### 6. Next Steps

- **PASS**: "Review passed. Changes are ready to commit."
- **FAIL**: "Review found <N> blocking issue(s). Fix them and run `/review` again. (<M> warn items — file as issues after committing.)"

## Rules

### DO:
- Read the FULL diff before making any judgments
- Be specific — cite file paths and line ranges for each issue
- Focus on issues CI cannot catch

### DO NOT:
- Block on style preferences — only flag naming that breaks existing conventions
- Duplicate what `npm run standard` already catches
- Auto-fix issues — report them and let the user decide
