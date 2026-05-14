# Hotfix Skill

You are applying a small, targeted fix without the full research/plan/implement pipeline.

## Core Principle

For trivial fixes (wrong constant, one-line formula correction, missing constraint), skip research and planning. Go straight to fix → test → review → ship.

## When to Use

This skill is for changes that are:
- **Small**: 1-10 lines of production code
- **Obvious**: The fix is clear without research
- **Low-risk**: No architectural decisions, no new abstractions

If the fix requires understanding complex mathematical interactions or touches more than ~3 files, use `/build` or the manual pipeline instead.

## Workflow

When the user invokes `/hotfix <description>` or `/hotfix #<issue>`:

### 1. Understand the Fix

- If a GitHub issue is referenced, fetch it: `gh issue view <number>` (or `mcp__github__issue_read`)
- Parse the description from the user
- Understand what needs to change and why

### 2. Create a Branch

```bash
git checkout main && git pull
```

**If an issue number is given**:
```bash
gh issue develop <number> --name <number>-<slug> --checkout
```
**`gh` unavailable:** `git checkout -b <number>-<slug>`

**If no issue number is given**: `git checkout -b <slug>`

### 3. Find the Code

- Use Glob and Grep to locate the relevant code
- Read the affected files

### 4. Apply the Fix (TDD)

a. **Write/update tests first** — write a test for the expected correct behavior
b. **Verify the test fails**:
   ```bash
   npm test
   ```
c. **Apply the fix** — make the minimal change
d. **Run linting and tests**:
   ```bash
   npm run standard
   npm test
   ```
e. **If tests fail**: debug directly — no recovery agents needed for a small fix

### 5. Review + Auto-fix

Invoke `/review` via the Skill tool.

**If P1/P2 findings**: auto-fix, re-run tests, then re-invoke `/review` once.
- If the second review still has P1/P2 findings: **STOP** and report.
- If P3 only or no findings: proceed to commit.

### 6. Ship (fully autonomous)

a. **Commit** — invoke `/commit`
b. **Push** — invoke `/push`
c. **Pull Request** — invoke `/pull-request`

### 7. Report

> "Hotfix applied: `<commit hash>` <commit message>
>
> Changed: <list of files>
> Tests: All passing
> Review: PASSED
> PR: <URL>"

## Rules

### DO:
- Keep it small — if the fix grows beyond ~10 lines, stop and suggest `/build`
- Write tests for behavior changes
- Run the full test suite before committing

### DO NOT:
- Create research documents, plans, or progress files
- Refactor surrounding code
- Skip creating a branch — always branch from `main`
