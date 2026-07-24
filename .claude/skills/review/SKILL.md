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

**Reviewer priority tiers** — used to resolve conflicts automatically (higher tier wins):

| Tier | Domains | Rationale |
|------|---------|-----------|
| 1 (highest) | `security` | Vulnerabilities override everything else |
| 2 | `correctness`, `impact` | Wrong results and broken callers are hard facts |
| 3 | `conventions` | The project has already decided; one-off optimisations don't override it |
| 4 | `tests`, `docs` | Quality improvements, but not load-bearing |
| 5 (lowest) | `structure`, `performance` | Speculative; trade-offs often context-dependent |

Wait for all eight. Then merge in four passes:

**Pass A — Group by location.** Group all findings by the code location they target (same file + overlapping line range, or the same named method/constant when no line number is given).

**Pass B — Classify each group:**
- **Single finding**: keep as-is.
- **Multiple findings, same direction** (compatible recommendations — e.g. two agents both say "this is a bug"): deduplicate into one entry, tag with both domains (e.g. `[correctness, impact]`), keep the higher severity (Block beats Warn).
- **Multiple findings, opposing direction** (conflicting recommendations — e.g. performance says "cache this constant" while conventions says "leave it inline"):
  - **Different tiers**: the higher-tier domain wins. Emit the winning finding tagged `[domain-A overrides domain-B]` with a one-line note: "domain-B suggestion suppressed: domain-A (tier N) takes precedence." Drop the losing finding entirely.
  - **Same tier**: neither wins. Emit a single `Conflict` entry stating each domain's position. Surface for human decision.

**Pass C — Cross-PR conflict check.** For every Warn that survived Pass B, search open GitHub issues for the same file path and method/constant name using `mcp__github__search_issues` (query: `repo:owner/repo is:open <filename> <method-or-constant-name>`). If an open issue exists whose recommended direction **opposes** the current Warn, apply the same tier rule: if the current finding outranks the existing issue's domain, keep the Warn and add a note to close the old issue. If the existing issue's domain outranks or ties the current finding, promote the Warn to a `Conflict` entry and reference the issue number: "Today's [domain] says: <position>. Open issue #N says: <opposing position>. Needs human decision — resolve the issue or close it before acting on this finding."

**Pass D — Produce the merged list:** Block first, then Conflict (needs a human decision), then Warn.

### 5. Auto-fix Warn Findings (fully autonomous)

Warn findings are real problems — each review agent only emits `Warn` for something it's already confident is wrong, just not commit-blocking. Rather than leaving them for a human to notice and file later, size and route them exactly like any other bug the pipeline finds: **fix what's fixable now, file only what's genuinely hard.**

**Skip this step** if the merged Warn list from Pass D is empty.

a. Spawn `ops-triage` with `branch`, `session_kind: "review"`, `target_issue` (the branch's linked issue if known, else `null`), and `observations` built from every Warn entry: `summary` = the finding's one-line description, `stage: "review"`, `evidence` = the file:line and the reviewing agent's rationale, `orchestrator_call: "bug"` (Warn findings are already vetted as real by a specialized reviewer — `ops-triage` is sizing them for routing, not re-litigating whether they're real).

b. Act on the result the same way every other triage stage in this codebase does:
   - **`definite` with `route: "fix"`** (trivial/moderate): spawn `ops-fix` with `summary`, `difficulty`, `fix_context`, `branch` — one bug at a time, sequentially (they share the working tree). On `status: "fixed"`, mark that Warn entry **fixed inline**. On `status: "escalated"`, fall through to filing (next bullet) using the entry's `title`, `priority: "medium"` (default), `extra_labels: ["bug"]`, and a body built from `summary` plus the escalation reason.
   - **`definite` with `route: "file"`** (difficult): invoke `ops-issue` with the drafted fields. Mark that Warn entry **filed** with the returned URL.
   - **`ambiguous`**: treat conservatively as filed, not skipped — invoke `ops-issue` using `draft_title` and a body built from `summary` plus the triage `reason`. Warn findings already passed one round of specialist review; don't silently drop them, and don't break full autonomy to ask a human mid-review.
   - **`not_a_bug`**: drop silently — `ops-triage` is allowed to override a reviewer's false positive.

c. After every `ops-fix` call has returned, run `npm run standard && npm test` once more as a final check across the combined set of in-place fixes. If it fails, **stop** — report the failure instead of proceeding to Step 6 with a broken tree.

### 6. Generate Report

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
> - [x] `[domain]` file:line — description and recommendation — **fixed inline** | **filed: <URL>**
>
> **Verdict**: PASS | FAIL (<N> to fix before commit, <C> to decide)

Verdict is FAIL if there are any Block items. Conflict items do not block commits but need a human call. Warn items never block commits and are always resolved by Step 5 before this report is generated — every Warn line ends in "fixed inline" or "filed: `<URL>`", never left open. If Block, Conflict, and Warn are all empty, output `Verdict: PASS` with no lists.

### 7. Next Steps

- **PASS**: "Review passed. Changes are ready to commit."
- **FAIL**: "Review found <N> blocking issue(s). Fix them and run `/review` again. (<C> conflicts still need a human call.)"
- **Conflicts present**: After listing them, ask the user to pick a side for each one using `AskUserQuestion` before proceeding.

## Rules

### DO:
- Read the FULL diff before making any judgments
- Be specific — cite file paths and line ranges for each issue
- Focus on issues CI cannot catch
- Resolve every Warn finding in Step 5 — fix trivial/moderate ones via `ops-fix`, file only difficult ones via `ops-issue`

### DO NOT:
- Block on style preferences — only flag naming that breaks existing conventions
- Duplicate what `npm run standard` already catches
- Auto-fix Block or Conflict findings — report them and let the calling skill's auto-fix loop, or the user, decide. (Warn findings are the deliberate exception: Step 5 always resolves them via `ops-fix`/`ops-issue`.)
