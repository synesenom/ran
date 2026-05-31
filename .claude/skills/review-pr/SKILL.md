# PR Review Command

> **Scope:** This skill is for reviewing **externally submitted GitHub PRs** (pull requests opened by contributors on GitHub). It is entirely distinct from:
> - `/review` — reviews *local* branch changes before committing; used inside the `/build` pipeline
> - `review-security`, `review-correctness`, etc. — internal quality-check subagents spawned by `/review` and `/build`; never invoked by users directly
>
> Do **not** use this skill during task resolution. It is only for triaging incoming contributor PRs.

You are reviewing a GitHub PR and posting a binding decision: **approve + merge** if all quality checks pass, or **request changes** if any blocking issue is found.

## Core Principle

Catch issues CI cannot. The output is a GitHub review action posted to the PR, not a chat report. Every invocation ends with either an APPROVE+merge or a REQUEST_CHANGES comment on GitHub.

## Workflow

When the user invokes `/review-pr <PR-URL-or-number>`:

### 1. Parse Input

Extract owner, repo, and PR number:
- Full URL `https://github.com/<owner>/<repo>/pull/<N>` → parse all three fields
- Bare number → default to `synesenom/ran`

### 2. Fetch PR Context (parallel)

Use the GitHub MCP tools in a single parallel call:
- `mcp__github__pull_request_read(method="get")` — title, state, draft flag, head SHA, body
- `mcp__github__pull_request_read(method="get_diff")` — full unified diff
- `mcp__github__pull_request_read(method="get_files")` — changed file list with stats

**Guard rails — stop before doing any review if:**
- `state !== "open"` → "PR #N is already `<state>`. Nothing to do."
- `draft === true` → "PR #N is a draft. Mark it ready for review first."
- diff is empty → "PR #N has no diff. Nothing to review."

### 3. Check Out the PR Branch and Run the Suite

Fetch the PR head into a local ref, run lint + tests, then return to the original branch:

```bash
git fetch origin pull/<N>/head:pr-<N>-review
git checkout pr-<N>-review
npm run standard 2>&1
npm test 2>&1
git checkout -
git branch -D pr-<N>-review
```

Run lint and tests sequentially (tests depend on lint passing). Capture full output.

**If either command exits non-zero**, record a **P1** finding:
- `[tests] CI` — `npm run standard` failed: `<first error line(s)>`
- `[tests] CI` — `npm test` failed: `<failing test names and coverage breach lines>`

**Do not stop** — continue to Pass 1 and Pass 2 so the full picture is reported in one review comment.

### 4. Save Diff

```bash
mkdir -p .claude/tmp
# write the diff to a temp file so review agents can read it
```

Save the diff text to `.claude/tmp/review-diff-pr-<N>.patch`.

### 5. Pass 1 — Convention Compliance (against diff)

External PRs have no local plan file, so Pass 1 checks project conventions from `CLAUDE.md` directly against the diff:

| Check | Fail condition |
|-------|---------------|
| **CHANGELOG** | User-visible change (bug fix, new feature, removed code) present but no `CHANGELOG.md` hunk in the diff |
| **Debug leftovers** | `console.log`, `TODO`, `FIXME`, or large commented-out code blocks added |
| **Comment style** | Comments that describe *what* the code does rather than *why* (WHAT comments are flagged; WHY comments are fine) |
| **Distribution constants** | `this.c = [...]` positional array instead of `this.c = { name: value, ... }` named object |
| **Subclass constants** | Leaf-subclass uses `this.c = { ... }` when a parent already sets `this.c` (should be `Object.assign`) |
| **Error conventions** | `undefined` returned as an error sentinel (should be `NaN`, `Infinity`, or `throw`) |

Each failed check is a **P2** finding. Record them alongside the agent findings from Pass 2.

### 6. Pass 2 — Code Quality (Parallel Agents)

**CRITICAL: Launch exactly 6 review agents in a single parallel call. Verify all 6 returned before proceeding.**

Tell each agent to read `.claude/tmp/review-diff-pr-<N>.patch` and provide enough diff context so they can assess without needing extra file access. Each agent returns findings rated P1/P2/P3.

- **review-security** agent
- **review-performance** agent
- **review-simplicity** agent
- **review-tests** agent
- **review-docs** agent
- **review-correctness** agent

Wait for all 6. Deduplicate overlapping findings. If you downgrade a finding's severity, note the original severity and your rationale.

### 7. Verdict

**PASS** — zero P1 or P2 findings across both passes. P3 items are informational and do not block.

**FAIL** — one or more P1 or P2 findings.

### 8. Act on Verdict

#### PASS → Approve and merge

Post an APPROVE review:

```
mcp__github__pull_request_review_write(
  method="create",
  event="APPROVE",
  commitID=<head SHA>,
  body=<approval body — see format below>
)
```

Then immediately merge (squash):

```
mcp__github__merge_pull_request(
  method="squash"   (or the equivalent squash parameter)
)
```

#### FAIL → Request changes

Post a REQUEST_CHANGES review:

```
mcp__github__pull_request_review_write(
  method="create",
  event="REQUEST_CHANGES",
  commitID=<head SHA>,
  body=<findings body — see format below>
)
```

Do **not** merge.

### 9. Review Body Format

#### Approval body (PASS)

```
LGTM — all quality checks passed.

<One sentence describing what the PR does and why it looks correct.>

<If any P3 items exist:>
**Notes (non-blocking):**
- [domain] file:line — <note>
```

#### Request-changes body (FAIL)

```
<If P1 items:>
## Required (P1 — blocking)
- [ ] [domain] `file:line` — <description and exact fix>

<If P2 items:>
## Required (P2 — blocking)
- [ ] [domain] `file:line` — <description and exact fix>

<If P3 items:>
## Informational (non-blocking)
- [domain] `file:line` — <note>
```

### 10. Report to User

After posting to GitHub, report back:

**PASS:**
> PR #N approved and merged.
> P3 notes (if any): <list>

**FAIL:**
> PR #N: changes requested — <N> blocking issue(s).
> <Bulleted list of P1/P2 findings>

## Rules

### DO:
- Fetch the full diff before running any agent
- Launch all 6 review agents in a single parallel call and wait for all 6
- Post a GitHub review (APPROVE or REQUEST_CHANGES) — never just a comment
- Merge immediately and automatically after approving — this is the contract
- Be specific: cite file path and line number for every finding

### DO NOT:
- Approve a PR that has any P1 or P2 finding
- Merge without first posting an APPROVE review
- Merge a draft PR or a non-open PR
- Post REQUEST_CHANGES when the PR passes all checks
- Poll GitHub with sleep — act and report, then end the turn
