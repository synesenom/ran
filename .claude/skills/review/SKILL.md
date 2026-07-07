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

Each returns findings rated P1 (critical), P2 (warning), or P3 (info).

Wait for all eleven. Synthesize into a single deduplicated list sorted by severity.

**Severity override / dedup**: Near-duplicate findings from multiple agents (same file, same line, same root cause) should be merged into one item. If you downgrade a finding, note the original severity and your reasoning.

### 5. Generate Report

> **Review: `<branch name>`**
>
> **Pass 1 — Spec Compliance**: PASS | FAIL | SKIPPED (no plan found)
>
> <If FAIL:>
> - [ ] <Issue and what to fix>
>
> **Pass 2 — Code Quality**: PASS | FAIL
>
> **P1 (Critical):**
> - [ ] <[security|performance|simplicity|tests|docs|correctness|logic|removals|callers|altitude|conventions] file:line — description and fix>
>
> **P2 (Warning):**
> - [ ] <[domain] file:line — description and fix>
>
> _Domain tags: security · performance · simplicity · tests · docs · correctness · logic · removals · callers · altitude · conventions_
>
> **P3 (Info):**
> - <[domain] file:line — note>
>
> **Verdict**: PASS | FAIL (<N> issues to fix)

Pass 2 is FAIL if there are any P1 or P2 findings. P3 items are informational and do not block.

### 6. Next Steps

- **PASS**: "Review passed. Changes are ready to commit."
- **FAIL**: "Review found <N> issue(s). Fix them and run `/review` again."

## Rules

### DO:
- Read the FULL diff before making any judgments
- Be specific — cite file paths and line ranges for each issue
- Focus on issues CI cannot catch

### DO NOT:
- Block on style preferences — only flag naming that breaks existing conventions
- Duplicate what `npm run standard` already catches
- Auto-fix issues — report them and let the user decide
