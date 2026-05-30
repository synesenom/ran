# Build Skill

You are running the full research-to-PR pipeline autonomously: `/research` → `/plan` → `/implement` → `/validate` → `/review` → ship.

## Core Principle

Execute the entire chain with minimal user interruption. Each stage invokes the corresponding leaf skill via the Skill tool — the orchestrator owns the sequencing, not the skill logic itself. Only escalate to the user when there is genuine ambiguity that cannot be safely auto-resolved. **If any test fails and auto-recovery is exhausted, STOP immediately.**

## Workflow

When the user invokes `/build <argument>`:

The `<argument>` is a GitHub issue number (e.g. `#111` or `111`), an issue URL, or a topic description.

---

### Stage 0: Discovery + Branch Setup (always runs first)

**Step 0a — Discovery.**

**If `<argument>` is a topic description (no issue number or URL):** skip doc detection — run the full pipeline from Stage 1.

**If `<argument>` is an issue number or URL:**

1. Extract the issue number.
2. Search for an existing research document:
   - Glob `thoughts/research/*.md` and grep for `github_issue: <number>` in the frontmatter, or look for a filename containing `issue-<number>`.
3. Search for an existing plan document:
   - Glob `thoughts/plans/*.md` and look for a filename containing `issue-<number>`.

**Determine the starting stage:**

| Research found | Plan found | Starting stage |
|---|---|---|
| No | No | Stage 1 (full pipeline) |
| Yes | No | Stage 2 (skip research) |
| Yes | Yes | Stage 3 (skip research + plan) |

**Step 0b — Branch setup.**

Check the current branch: `git branch --show-current`.

**If `<argument>` is an issue number/URL:**
- If the branch already starts with the issue number, stay on it.
- Otherwise, fetch the issue title, derive a slug, then create a linked branch from clean `main`:
  ```bash
  git checkout main && git pull
  gh issue develop <number> --name <number>-<slug> --checkout
  ```
  **`gh` unavailable:** use `mcp__github__issue_read` and create locally: `git checkout -b <number>-<slug>`.

**If `<argument>` is a topic description:**
- If already on a non-`main` branch, stay on it.
- Otherwise, derive a slug from the description and branch from clean `main`:
  ```bash
  git checkout main && git pull
  git checkout -b topic-<slug>
  ```

**Step 0c — Report.**

> "Discovery: research `<path or NONE>`, plan `<path or NONE>` — starting at Stage <N>. Branch: `<branch-name>`."

---

### Stage 1: Research (fully autonomous)

**Skip** if Stage 0 found an existing research document.

Otherwise, invoke `/research` via the Skill tool, passing `<argument>`.

**Escalation**: Never.

---

### Stage 2: Plan (mostly autonomous)

**Skip** if Stage 0 found an existing plan document.

Otherwise, invoke `/plan` via the Skill tool, passing the research document from Stage 1.

Design decisions are auto-resolved by `design-propose` + `design-critique`. Only low-confidence decisions escalate.

**Escalation**: Only for low-confidence design decisions.

---

### Stage 3: Implement (mostly autonomous)

Invoke `/implement` via the Skill tool, passing the plan from Stage 2.

Report progress after each phase:
> "Phase <N> complete: <name> — all tests passing. Continuing to Phase <N+1>."

**Escalation**: Only after 3 failed auto-recovery attempts or a rejected fix.

---

### Stage 4: Validate Loop (mostly autonomous)

Invoke `/validate` via the Skill tool, passing the issue number.

**If PASS**: Proceed to Stage 4.5.

**If FAIL**: Fix each unmet criterion, re-run `npm run standard && npm test`, then re-invoke `/validate`.

**Loop up to 3 times.** After each attempt:
> "Validate attempt <N>/3: <PASS or FAIL — N criteria unmet>"

**After 3 consecutive failures**, STOP and escalate.

**Skip** if `<argument>` is a topic description with no GitHub issue.

---

### Stage 4.5: Bug Triage (mostly autonomous)

While running Stages 1-4, you may have observed things that *might* be bugs unrelated to the current task — a pre-existing NaN at a boundary, a flaky test, a docstring that contradicts the code, an unexpected empirical result during cross-validation. The triage stage forces the question "should any of these be filed?" rather than relying on you to remember the global rule mid-flow.

**Step 4.5a — Collect observations.**

Compile every candidate concern noticed during the build into a structured list. Each entry needs:
- `summary` — one-line description
- `stage` — where it surfaced (`research`, `implement`, `validate`, `review`)
- `evidence` — file:line, test output, or empirical result
- `orchestrator_call` — your tentative classification (`bug`, `suspect`, `not-a-bug`) and one-line reason

If you genuinely noticed nothing, pass an empty list — the agent will skim the diff for red flags as a safety net.

**Step 4.5b — Invoke `ops-triage`.**

Spawn the `ops-triage` agent with `branch`, `session_kind: "build"`, `target_issue`, `observations`, and `diff_path` (the patch file from `.claude/tmp/`, if Stage 5 hasn't created it yet, build one with `git diff origin/main...HEAD > .claude/tmp/triage-diff-<branch>.patch`).

The agent returns three buckets: `definite`, `ambiguous`, `not_a_bug`.

**Step 4.5c — Act on the result.**

- **`definite` (auto-file in batch)**: For each entry, invoke `ops-issue` with the drafted `title`/`body`/`priority`/`difficulty`/`extra_labels`. Collect the returned issue URLs.
- **`ambiguous` (escalate in batch)**: Use a single `AskUserQuestion` with one question per entry, options "File issue" / "Skip", plus an "Other" fallback. For each "File issue" answer, invoke `ops-issue` using the `draft_title`. Skip the rest silently.
- **`not_a_bug`**: silent.

**Step 4.5d — Report.**

> "Triage: <N> filed (<URLs>), <M> skipped, <K> not a bug."

If all three buckets are empty: "Triage: clean."

**Escalation**: Only on `ambiguous` entries (batched into one prompt).

**Skip**: Never. Always run, even on topic-driven builds — the diff still warrants a red-flag skim.

---

### Stage 5: Review + Auto-fix (fully autonomous)

Invoke `/review` via the Skill tool.

**Never pause after review output.** Apply fixes immediately.

If P1/P2 findings: auto-fix, re-run tests, re-review. Loop up to 3 times.

If P3 only or no findings: pass immediately.

**After 3 consecutive review failures**, escalate.

---

### Stage 5.5: Compound (fully autonomous)

Invoke `/compound` via the Skill tool immediately after review passes. Do not pause or ask for confirmation.

---

### Stage 6: Ship (fully autonomous)

Execute sequentially via the Skill tool **in a single uninterrupted sequence**:

a. **Commit** — invoke `/commit`
b. **Push** — invoke `/push`
c. **Pull Request** — invoke `/pr`

**Do NOT pause, confirm, or ask for permission before push or pr.** These are expected pipeline steps already authorized by the user invoking `/build`. Treat them identically to commit — run immediately.

**Escalation**: Never.

---

### Stage 7: Report

> "Build complete!
>
> Research: `<path>` (or SKIPPED)
> Plan: `<path>` (or SKIPPED)
> Implementation: <N> phases executed
> Tests: All passing (lint + tests)
> Validate: PASSED (<N> attempts) or SKIPPED
> Triage: <N> filed / <M> skipped / clean
> Review: PASSED (<N> issues auto-fixed)
> Compound: `<solution path>` (or SKIPPED)
> Commit: `<hash>` <message>
> PR: <URL>
>
> Escalations: <N> (or None)"

---

## Error Handling

- **Test failure (unrecoverable)**: STOP after auto-recovery is exhausted. Report which phase failed.
- **No plan possible**: STOP after research. Ask the user to clarify scope.
- **Validation failure (unrecoverable)**: STOP after 3 attempts. Report which criteria remain unmet.
- **Review failure (unrecoverable)**: STOP after 3 auto-fix attempts. Report remaining P1/P2 issues.
- **Compound failure**: Never blocks the pipeline. Log "Compound: SKIPPED" and continue to Stage 6.

## Rules

### DO:
- Invoke each leaf skill via the Skill tool — do not inline their logic
- Stop immediately on unrecoverable failure
- Keep the user informed with brief progress updates between stages

### DO NOT:
- Ask the user to make choices when confidence is high
- Continue past an unrecoverable failure
- Force push or use destructive git operations
- Skip any stage other than research/plan when existing documents are present
