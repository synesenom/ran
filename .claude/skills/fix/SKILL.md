# Fix Skill

You are fixing a straightforward GitHub issue that does not require research or planning — just do the work and ship it.

## Core Principle

For issues where the fix is obvious (docs updates, formula corrections, parameter constraint additions, small refactors), skip the research/plan pipeline entirely. Go straight to branch → fix → test → ship.

## When to Use

This skill is for issues that are:
- **Self-explanatory**: The issue description tells you exactly what to do
- **No design decisions**: No architectural choices, no alternatives to weigh
- **Any size**: Unlike `/hotfix` (which caps at ~10 lines), this handles larger changes that don't need research or planning

If the issue requires understanding complex mathematical interactions or making design decisions, use `/build` instead.

## Workflow

When the user invokes `/fix <argument>`:

### 1. Fetch the Issue

```bash
gh issue view <number>
```
(or `mcp__github__issue_read` if `gh` is unavailable)

### 2. Create a Branch

```bash
git checkout main && git pull
gh issue develop <number> --name <number>-<slug> --checkout
```

**`gh` unavailable:** `git checkout -b <number>-<slug>`

### 3. Do the Work

- Use Glob and Grep to locate relevant files
- Read the files to understand the current state
- Make all the changes needed to resolve the issue
- Make independent edits in parallel where possible

### 4. Run Tests

```bash
npm run standard
npm test
```

If tests fail, debug and fix. If the fix grows too complex, stop and suggest `/build` instead.

### 5. Bug Triage

Compile observations noticed during steps 3–4 (pre-existing NaN at a boundary, a flaky test, a docstring that contradicts the code, etc.) into a structured list. Each entry needs `summary`, `stage`, `evidence`, and your tentative `orchestrator_call`.

Spawn the `ops-triage` agent with `branch`, `session_kind: "fix"`, `target_issue`, the `observations` list, and a `diff_path` (write `git diff main...HEAD` to `.claude/tmp/triage-diff-<branch>.patch` if not already done).

Act on the result:
- **`definite`**: invoke `ops-issue` once per entry with the drafted fields. Collect URLs.
- **`ambiguous`**: one batched `AskUserQuestion` (File issue / Skip / Other). For each "File issue", invoke `ops-issue`.
- **`not_a_bug`**: silent.

Report: `> "Triage: <N> filed (<URLs>), <M> skipped, <K> not a bug."` or `> "Triage: clean."`

### 6. Review (conditional)

Check if any `.js` files were modified:

```bash
git diff main --name-only | grep '\.js$'
```

**If `.js` files were modified**: invoke `/review` via the Skill tool. If P1/P2 findings, auto-fix, re-run tests, and re-review once. If still P1/P2 after retry, STOP and report.

**If no `.js` files were modified**: skip review.

### 7. Ship (fully autonomous)

Invoke all three sub-skills in sequence **without any pause or output between them**. As soon as one returns, invoke the next immediately. Do not generate any text between steps — no confirmation prompts, no interim status messages. Proceed directly to step 8 only after all three have completed.

a. **Commit** — invoke `/commit`
b. **Push** — invoke `/push` immediately after `/commit` returns
c. **Pull Request** — invoke `/pull-request` immediately after `/push` returns

### 8. Report

> "Resolved: `<commit hash>` <commit message>
>
> Issue: #<number> — <title>
> Changed: <list of files>
> Tests: All passing
> Triage: <N> filed / <M> skipped / clean
> Review: PASSED / SKIPPED (no .js changes)
> PR: <URL>"

## Rules

### DO:
- Always start from a clean `main`
- Run the full test suite before shipping
- Review when `.js` files are touched

### DO NOT:
- Create research documents, plans, or progress files
- Refactor surrounding code — only resolve the issue
- Continue if the work becomes complex enough to need planning — suggest `/build` instead
