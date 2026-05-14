# Validate Skill

You are validating that a GitHub issue's problem has been fully resolved by the current branch's implementation.

## Core Principle

Verify that every acceptance criterion in the issue is satisfied by the actual code changes and that all tests pass. This is a post-implementation check — it does not fix anything, it only reports pass/fail.

## Workflow

When the user invokes `/validate <#issue>` or `/validate <issue-url>`:

### 1. Load the Issue

- If a GitHub issue number is provided, fetch it: `gh issue view <number>` (or `mcp__github__issue_read`)
- If no argument is provided, infer the issue from the current branch name (e.g. `42-add-log-series-distribution` → issue #42)

Read the issue title, body, and acceptance criteria.

### 2. Extract Acceptance Criteria

Parse the issue body for acceptance criteria (checkboxes, "Acceptance Criteria" sections, numbered lists).

> **Issue #<number>: <title>**
>
> Acceptance criteria:
> 1. <criterion 1>
> 2. <criterion 2>

### 3. Gather Implementation Context

Run in parallel:
- `git diff main...HEAD` — full diff
- `git log main..HEAD --oneline` — commits

Also spawn the **discovery-thoughts** agent to find any related plan or research.

### 4. Verify Each Criterion

For each criterion:

a. **Read the relevant code** — use Glob and Grep to find it
b. **Trace the logic** — confirm the behavior matches what was requested
c. **Check for tests** — verify tests exercise this criterion
d. **For new distributions**, verify:
   - Entry added to `test/dist-cases.js` with `invalidParams`, `params`, and `cases`
   - Distribution exported from `src/dist/index.js`
   - `npm test` passes (KS/chi-squared test passes for sample output)

Mark each as PASS or FAIL with a brief explanation.

### 5. Run Tests

```bash
npm run standard
npm test
```

If tests fail, mark the test section as FAIL and include the failure output.

### 6. Generate Report

> **Validation: Issue #<number> — <title>**
>
> **Acceptance Criteria:**
>
> | # | Criterion | Status | Evidence |
> |---|-----------|--------|----------|
> | 1 | <criterion> | PASS/FAIL | <file:line or explanation> |
>
> **Tests:**
> - Linting (npm run standard): PASS/FAIL
> - Test suite (npm test): PASS/FAIL
>
> **Verdict: PASS / FAIL (<N> criteria unmet, <M> test failures)**

### 7. Next Steps

- **PASS**: "Validation passed. Issue #<number> is fully resolved by this branch."
- **FAIL**: "Validation failed. <N> criteria unmet: ..."

## Rules

### DO:
- Check EVERY criterion
- Be specific about where each criterion is satisfied
- Run the full test suite even if criteria look good

### DO NOT:
- Fix issues — only report them
- Skip running tests
- Mark a criterion as PASS without concrete evidence in the code
