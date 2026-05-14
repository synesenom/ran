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

### 7. Report

> "Created <N> issue(s):
>
> | Issue | Title | Priority | Difficulty |
> |-------|-------|----------|------------|
> | #<N>  | ...   | ...      | ...        |"

## Rules

### DO:
- Launch all 5 scout agents in parallel
- Always deduplicate against existing open issues
- Let the user pick — never auto-create issues
- Use `ops-issue` for issue creation — never call `gh issue create` directly
- Use multi-select so the user can pick multiple suggestions at once

### DO NOT:
- Create issues without user confirmation
- Skip the ranking/dedup step
