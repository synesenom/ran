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

**CRITICAL: Launch exactly 8 review agents. Verify all 8 returned results before proceeding.**

Save the diff to a temporary file:
```bash
mkdir -p .claude/tmp && git diff main...HEAD > .claude/tmp/review-diff-$(git branch --show-current).patch
```

Then launch all eight **in a single parallel call**, telling each to read `.claude/tmp/review-diff-<branch-name>.patch`:

- **review-security** agent — injection risks, prototype pollution, DoS via input
- **review-performance** agent — unnecessary allocations, redundant computation, hot-path issues
- **review-structure** agent — over-engineering and wrong abstraction level
- **review-conventions** agent — CLAUDE.md rule violations (reads CLAUDE.md, quotes exact rules)
- **review-tests** agent — test quality: behavior-first, edge cases, statistical rigor
- **review-docs** agent — missing/stale JSDoc, README, ADRs, what-comments
- **review-correctness** agent — mathematical/statistical errors, numerical instability, general logic bugs
- **review-impact** agent — dropped guards/invariants (deleted lines) and cross-file caller breakage

Each agent returns `Block` findings (must fix before commit), `Warn` findings (real problem, file as issue), or `No issues found.`

Wait for all eight. Then merge in three passes:

**Pass A — Group by location.** Group all findings by the code location they target (same file + overlapping line range, or the same named method/constant when no line number is given).

**Pass B — Classify each group:**
- **Single finding**: keep as-is.
- **Multiple findings, same direction** (compatible recommendations — e.g. two agents both say "this is a bug"): deduplicate into one entry, tag with both domains (e.g. `[correctness, impact]`), keep the higher severity (Block beats Warn).
- **Multiple findings, opposing direction** (conflicting recommendations — e.g. performance says "cache this constant" while conventions says "leave it inline"): emit a single `Conflict` entry. State each domain's position in one sentence each. Do NOT pick a winner or suppress either view — surface the disagreement for the user to resolve.

**Pass C — Produce the merged list:** Block first, then Conflict (needs a human decision), then Warn.

### 5. Generate Report

> **Review: `<branch name>`**
>
> **Spec**: PASS | FAIL | SKIPPED (no plan found)
> <If FAIL: bulleted list of spec gaps>
>
> **Block (<N>):**
> - [ ] `[domain]` file:line — description and fix
>
> **Conflict (<N>):**
> - [ ] `[domain-A vs domain-B]` file:line — **Domain-A says**: <position>. **Domain-B says**: <position>. Needs human decision.
>
> **Warn (<N>):**
> - [ ] `[domain]` file:line — description and recommendation
>
> **Verdict**: PASS | FAIL (<N> to fix before commit, <C> to decide, <M> to file)

Verdict is FAIL if there are any Block items. Conflict and Warn items do not block commits — Conflicts need a human call, Warns should be filed as issues. If Block, Conflict, and Warn are all empty, output `Verdict: PASS` with no lists.

### 6. Next Steps

- **PASS**: "Review passed. Changes are ready to commit."
- **FAIL**: "Review found <N> blocking issue(s). Fix them and run `/review` again. (<C> conflicts and <M> warn items — resolve/file after committing.)"
- **Conflicts present**: After listing them, ask the user to pick a side for each one using `AskUserQuestion` before proceeding.

## Rules

### DO:
- Read the FULL diff before making any judgments
- Be specific — cite file paths and line ranges for each issue
- Focus on issues CI cannot catch

### DO NOT:
- Block on style preferences — only flag naming that breaks existing conventions
- Duplicate what `npm run standard` already catches
- Auto-fix issues — report them and let the user decide
