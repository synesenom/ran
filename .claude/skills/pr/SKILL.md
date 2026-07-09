# Pull Request Command

You are creating a GitHub Pull Request for the current branch with an AI-generated summary that highlights non-trivial changes for manual review.

## Core Principle

Categorize every change as trivial or non-trivial so reviewers can focus their attention where it matters most.

## Workflow

When the user invokes `/pr`:

### 1. Gather Context

Run in parallel:
- `git branch --show-current`
- `git log main..HEAD --oneline`
- `git diff main...HEAD`
- `git status`
- `git log main..HEAD --format="%s%n%n%b"`

If the branch is `main`, stop. If no commits ahead of main, stop. If there are uncommitted changes, invoke `/commit` first.

### 2. Pre-flight CI checks

Run all four CI jobs locally in sequence. Stop immediately and report the failure if any step exits non-zero — do not open the PR.

```bash
npm run standard
npm run jsdoclint
npm test
npm run build && npm run typecheck
```

Report format on failure:
> "Pre-flight failed: `<step name>` — <first error line>. Fix the issue and run `/pr` again."

### 3. Sync with Main

Before opening the PR, merge the latest `main` into the current branch to eliminate post-open merge conflicts.

Run in sequence:
```bash
git fetch origin main
git merge origin/main --no-edit
```

If the merge **succeeds cleanly**, push the updated branch:
```bash
git push -u origin <current-branch>
```

If the merge **fails with conflicts**:
1. Run `git status` to list conflicting files.
2. Resolve each conflict automatically only when the resolution is unambiguous (e.g., the branch added a new file that `main` never touched).
3. If any conflict is ambiguous, abort the merge (`git merge --abort`), report the conflicting files to the user, and stop — do not proceed to PR creation.
4. After resolving, run `npm run standard && npm test` to confirm the merge didn't break anything, then `git commit --no-edit` and push.

### 4. Detect the Issue Number

Search in this order, stopping at the first match:

1. **Branch name** — patterns: `^(\d+)-`, `^claude/build-(\d+)-`, `^claude/(\d+)-`
2. **Commit messages** — `git log main..HEAD --format=%B | grep -oE '#[0-9]+'`
3. **Plan frontmatter** — look for `github_issue: <number>`

If no issue detected, skip the closing keyword. Do not invent one.

Verify the issue is open before adding the keyword:
```bash
gh issue view <number> --json number,state -q '.state' 2>/dev/null
```
Skip if `CLOSED` or lookup fails.

### 5. Analyze Changes

Categorize every change:

**Non-trivial** (warrant manual review):
- New distributions or statistical methods
- Changed PDF/CDF/quantile formulas
- New special functions or algorithms
- Behavioral changes (different return values, changed parameter constraints)
- New public API surface
- Dependency changes

**Trivial** (mechanical/low-risk):
- Formatting, whitespace, line reordering
- Method/function reordering within a file
- Renames with no logic change
- Import reordering or cleanup
- Docstring/comment additions only

### 6. ADR Gate (non-trivial PRs only)

Check for ADR references in the diff and commits:
```bash
git diff main...HEAD --name-only | grep decisions/
```

If non-trivial changes exist but no ADRs are found, add a warning block:

```markdown
> **⚠ Missing ADR**: This PR contains non-trivial changes but no Architecture Decision Record was found.
> Consider adding one at `decisions/` to document the design rationale.
> See `decisions/0000-template.md` for the format.
```

### 7. Generate PR Title

- Concise (under 70 characters), imperative mood
- e.g., "Add LogNormal distribution", "Fix CDF for discrete distributions"

### 8. Generate PR Body

```markdown
<If an issue was detected:>
Closes #<issue-number>

<If ADR warning needed, insert it here>

## Summary
- <1-3 bullet points describing what this PR does and why>

## Design decisions
<If ADRs exist:>
- [ADR-NNNN: <title>](decisions/NNNN-slug.md) — <one-line summary>

<If no ADRs and no non-trivial changes, omit this section.>

## Non-trivial changes
<List them:>
- **`<file path>`**: <Description of what changed and why it matters>

<If no non-trivial changes:>
_No non-trivial changes — this PR is purely mechanical._

## Comprehension checklist
- [ ] I can explain what this code does without reading line-by-line
- [ ] I understand *why* this approach was chosen over alternatives
- [ ] WHY comments are present where the logic is non-obvious
- [ ] Tests verify observable behavior, not internal state
- [ ] A developer encountering this code in 6 months could understand it

<details>
<summary>Trivial changes</summary>

- **`<file path>`**: <Brief description>

</details>

---
*Generated with [Claude Code](https://claude.ai/code)*
```

### 9. Create the PR

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
<body content>
EOF
)"
```

### 10. Watch the PR (CI + reviews)

Immediately after the PR is created, **subscribe to its activity** so CI failures and
review comments are handled without the user having to ask:

```
subscribe_pr_activity(<pr-number>)
```

> **Availability**: `subscribe_pr_activity` is provided by the remote-execution / GitHub
> webhook integration. If the tool is unavailable (e.g. a purely local `gh` session),
> skip this step and tell the user the PR can't be auto-watched here.

After subscribing, **end the turn** — do not poll with `sleep` or repeated status checks.
PR events arrive as `<github-webhook-activity>` messages that wake the session. When one
arrives, investigate it and follow this loop:

- **CI check failed** → reproduce locally, diagnose the root cause, push the fix, and update
  a short status checklist. Re-kick on each failure until green; the green status IS the
  deliverable, not a no-op to skip. Reply only when it resolves the task or raises a question.
- **Review comment** → if the fix is unambiguous and not architecturally significant, apply
  and push it. If there is **any** ambiguity (a comment open to interpretation, or a change
  touching something significant), use `AskUserQuestion` to confirm before acting.
- **Duplicate / no-action-needed event** → skip silently.
- **Merge conflict reported** → fetch the base branch, merge it in, resolve conflicts,
  re-run `npm run standard && npm test`, and push.

Stop watching the moment the user asks — call `unsubscribe_pr_activity(<pr-number>)` and push
no further changes to that PR.

### 11. Report

> "PR created: <URL>
>
> **Closes**: #<issue> (or "None")
> **Non-trivial changes**: <count> (or "None")
> **Watching**: subscribed to PR activity — I'll auto-fix failing CI and respond to review
> comments as they arrive (or "not available in this environment")."

## Rules

### DO:
- Read the FULL diff before categorizing
- Always include `Closes #N` when an issue is detectable
- Be specific about what changed in non-trivial items
- Subscribe to PR activity after creation and follow through on CI/review events
- Escalate ambiguous review comments via `AskUserQuestion` before acting

### DO NOT:
- Create a PR if on `main`
- Invent an issue number
- Add `Closes #N` for an already-closed issue
- Poll for CI/review status with `sleep` or repeated checks — react to webhook events instead
- Keep pushing to a PR after the user asks you to stop watching it
