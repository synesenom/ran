# Suggest Skill

You are generating and triaging potential future issues by scanning the codebase through specialist agents, deduplicating against existing issues, and letting the user pick which to create.

## Core Principle

Surface actionable improvements the user hasn't thought of yet. Let domain specialists find the gaps, rank everything objectively, and let the user decide what gets created.

## Workflow

When the user invokes `/suggest`:

### 1. Fetch Existing Issues

Run:
```bash
gh issue list --state open --limit 100 --json number,title,labels,body
```

Store the result for deduplication.

### 2. Spawn Scout Agents in Parallel

Launch all five scout agents **in parallel**:

| Agent | Domain | What it scans |
|-------|--------|---------------|
| `suggest-distributions` | New distributions | Existing distributions, special functions, missing families |
| `suggest-methods` | Statistical methods | Special functions, algorithms, summary statistics, hypothesis tests |
| `suggest-testing` | Test quality | Test suite, dist-cases.js, edge cases, correctness gaps |
| `suggest-infra` | Build & tooling | package.json, rollup, docs, CI, developer experience |
| `suggest-wildcard` | Anything | Unconstrained brainstorming across all dimensions |

Each agent returns 2-3 suggestions with title, description, priority, difficulty, and rationale.

### 3. Combine and Rank

Combine all suggestions into a single list tagged by domain. Launch the `suggest-rank` agent with:
- The combined suggestion list
- The existing open issues from Step 1

The ranker removes duplicates, flags related issues, scores each suggestion, and returns a ranked list.

### 4. Present Results

> **Suggested issues** (duplicates removed):
>
> | # | Title | Domain | Priority | Difficulty | Score | Status |
> |---|-------|--------|----------|------------|-------|--------|
> | 1 | ...   | distributions | high | moderate | 6 | NEW |
> | ...| ...  | ...    | ...      | ...        | ...   | ...    |

If duplicates were removed:

> **Duplicates skipped** (already tracked):
> | Suggestion | Existing Issue |
> |------------|---------------|
> | ...        | #N            |

### 5. Let the User Pick

Ask the user which suggestions to create as GitHub issues using a **multi-select** question.

### 6. Create Issues

For each selected suggestion, use the `ops-issue` agent to create a GitHub issue with the suggestion's title, description, priority, and difficulty.

Launch issue creation agents **in parallel** for all selected suggestions.

Keep the mapping of `suggestion → created issue (number, URL)` — Step 7 needs it.

### 7. Remove Filed Suggestions from `todo.md`

`todo.md` is a backlog of not-yet-filed work. Once a suggestion has been filed as a GitHub issue, it no longer belongs there — leaving it in place produces a duplicate the next `/suggest` run (or a human) could re-file.

For each issue created in Step 6:

1. Search `todo.md` for an entry that corresponds to the filed suggestion. Match by title first (e.g. a suggestion titled "Waring distribution" against a `#### Waring` heading), then by clear topical overlap in the body text if no heading matches exactly. Be conservative — only treat it as a match if you're confident it's describing the same piece of work, not merely a related one.
2. If a match is found, remove that entry entirely from `todo.md`:
   - A distribution/section entry (`#### Heading` or `### Heading`) — delete the heading and its full body, up to (but not including) the next heading of the same or higher level.
   - A list bullet (e.g. under a "Not Yet Filed" list) — delete just that bullet.
   - A table row (e.g. under a "Filed as GitHub Issues" table) — this only applies to entries that were *not yet* filed, so new rows are never added here as a result of this step.
   - Do not leave behind a placeholder, an "already filed" note, or a dangling link — the point is removal, not annotation.
   - If removing the entry leaves its parent section (e.g. a "Not Yet Filed" list) completely empty, remove that now-empty parent heading too rather than leaving a heading with no content under it.
3. If no match is found, skip — not every suggestion originates from `todo.md` (e.g. `suggest-testing` and `suggest-infra` findings usually don't).

If any entries were removed, commit `todo.md` with a message referencing the filed issue number(s) (e.g. `Remove filed todo.md entries (#830, #831)`) and push to the current branch.

### 8. Report

> "Created <N> issue(s):
>
> | Issue | Title | Priority | Difficulty |
> |-------|-------|----------|------------|
> | #<N>  | ...   | ...      | ...        |"

If any `todo.md` entries were removed, add a line noting which ones and for which issues.

## Rules

### DO:
- Launch all 5 scout agents in parallel
- Always deduplicate against existing open issues
- Let the user pick — never auto-create issues
- Use `ops-issue` for issue creation — never call `gh issue create` directly
- Use multi-select so the user can pick multiple suggestions at once
- After filing an issue, remove its corresponding entry from `todo.md` if one exists, and commit/push that change

### DO NOT:
- Create issues without user confirmation
- Skip the ranking/dedup step
- Leave a stale `todo.md` entry in place for a suggestion that was just filed as an issue
- Remove a `todo.md` entry that only loosely resembles the filed issue — when in doubt, leave it
