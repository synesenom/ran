# Next Skill

You are picking the most appropriate next issue to work on from the open GitHub backlog.

## Core Principle

Maximize impact relative to effort. Rank all open issues lexicographically by priority then difficulty, respect dependency chains, and present the top candidate with clear reasoning.

## Milestone Filtering

The user can optionally specify keywords after `/next` to restrict to issues whose milestone title contains all of those words (case-insensitive):

- `/next` — no filter, ranks all open issues
- `/next v2.0` — only rank issues whose milestone contains "v2.0"
- `/next distributions` — only rank issues whose milestone contains "distributions"

## Workflow

When the user invokes `/next` (with or without a milestone):

### 1. Fetch, Score, and Rank Issues

Run the ranking script:
```bash
# No milestone filter:
python3 .claude/skills/next/rank_issues.py

# With milestone keywords:
python3 .claude/skills/next/rank_issues.py distributions
```

The script outputs JSON with:
- `ranked` — unblocked issues sorted by: priority tier (desc), difficulty within tier (desc), unblocks count (desc), issue number (asc)
- `blocked` — issues with open dependencies

**Ranking reference:**
- Primary: priority — high > medium > low (unlabeled sinks below all)
- Secondary: difficulty (inverse) — trivial > moderate > difficult (unlabeled sinks below all)
- Tertiary: unblocks count (more is better)
- Final: issue number (ascending)

### 2. Present

> **Next issue: #\<number\> — \<title\>**
>
> | | |
> |---|---|
> | Priority | \<label\> |
> | Difficulty | \<label\> |
> | Unblocks | \<N\> issue(s) _(only if > 0)_ |
>
> **Why this one:** \<1-2 sentence explanation\>

Then show the **runner-up table** (top 5 after the pick):

> | Rank | Issue | Title | Priority | Difficulty | Unblocks |
> |------|-------|-------|----------|------------|----------|

If there are **blocked issues**, show them.

### 3. Suggest a Command and Offer Next Steps

Based on the picked issue's labels:

- **Difficulty = trivial AND obvious fix**: recommend `/hotfix`
- **Difficulty = trivial or moderate AND no design decisions**: recommend `/fix`
- **Difficulty = difficult OR implies design decisions or new math**: recommend `/build`

> **Suggested command:** `/hotfix|/fix|/build` — _\<one-sentence reason\>_

Then ask the user what to do using selectable options.

## Rules

### DO:
- Always fetch fresh issue data
- Respect dependency chains — never recommend a blocked issue
- Show the full ranking so the user can override

### DO NOT:
- Auto-start work without user confirmation
- Close, modify, or comment on issues
