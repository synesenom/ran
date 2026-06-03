# Resolve Skill

You are triaging a GitHub issue to recommend the fastest, safest workflow: `/hotfix`, `/fix`, or `/build`.

## Core Principle

Match the issue's complexity to the right pipeline. Recommending too lightweight a skill (e.g., `/hotfix` for something that needs design decisions) wastes time when the user hits a wall mid-flow. Recommending too heavy a skill (e.g., `/build` for a one-liner) slows delivery unnecessarily. This skill reads the issue and does a lightweight codebase probe to produce a confident recommendation before any work starts.

## Skill Selection Criteria

| Signal | `/hotfix` | `/fix` | `/build` |
|---|---|---|---|
| Estimated code change | 1–10 lines | Any size | Any size |
| Files touched | ≤ 3 | Any | Any |
| Description completeness | Exact location given | Self-explanatory | Research required |
| Design decisions needed | No | No | Yes |
| New math / algorithms / special functions | No | No | Yes |
| New distribution or new module | No | No | Yes |
| Difficulty label | trivial | trivial / moderate | difficult |

**Tiebreaker rules:**

- Uncertain between `/hotfix` and `/fix` → pick `/fix`. It is always safe.
- Uncertain between `/fix` and `/build` → look for design decisions (two valid approaches exist, trade-offs to weigh, new abstractions needed). If even one genuine design decision exists, pick `/build`.
- Long issue body alone is not a `/build` signal. An issue can be verbose and still need a one-liner.

## Workflow

When the user invokes `/resolve <number>`:

### 1. Fetch the Issue

Use `mcp__github__issue_read` to load the issue (the `gh` CLI is not available in this environment). Extract:

- Title
- Body (scope, acceptance criteria, implementation hints)
- Labels (priority, difficulty, breaking)
- Milestone

### 2. Analyze the Issue

Classify the signals you observe into three buckets:

**Signals that push toward `/build`:**
- Mentions new distributions, algorithms, special functions, or test modules
- Needs understanding of mathematical interactions (e.g., "verify numerical stability", "check the CDF integrates to 1")
- Acceptance criteria reference multiple independent subsystems
- Body is speculative: "investigate", "explore", "design", "we could consider"
- No clear implementation path is stated — the issue is a goal, not a recipe
- `difficult` difficulty label

**Signals that push toward `/hotfix`:**
- Names the exact wrong constant, missing guard, or off-by-one and where it lives
- The body says precisely what to swap and provides the correct value
- `trivial` difficulty label
- Touches at most 1–2 files
- The fix could be described as "find X, replace with Y"

**Signals that push toward `/fix`:**
- Self-explanatory body but the change spans several files (e.g., rename, constraint addition across all distributions)
- No design decisions, but not a pure one-liner
- `moderate` difficulty label
- Bug fix or small refactor that is obvious but non-trivial in size

### 3. Probe the Codebase

Use Glob and Grep to do a lightweight scan — **do not read large files in full**:

- How many files would plausibly need to change given the issue description?
- Does the fix require a new file (new distribution, new algorithm, new test case file)?
- Do existing patterns already constrain the design, reducing open decisions?

The goal is to catch issues that sound simple but touch many files, or sound complex but are really one function.

### 4. Produce the Recommendation

Pick exactly one of `/hotfix`, `/fix`, or `/build`. Present it as:

> **Recommendation: `/hotfix`** _(or `/fix` or `/build`)_
>
> **Issue:** #\<number\> — \<title\>
> **Labels:** \<priority\>, \<difficulty\>
>
> **Signals observed:**
> - \<signal 1 — from issue text or codebase probe\>
> - \<signal 2\>
> - \<signal 3 if relevant\>
>
> **Key factor:** \<the single thing that tipped the scale — be specific\>
>
> **Concerns / caveats:** \<anything the user should watch for mid-flow, or "None"\>

### 5. Offer Next Steps

Ask the user what to do using selectable options. Always include all three skill options plus a "just show the recommendation" option so the user can decide:

- Run `/hotfix #<number>` now
- Run `/fix #<number>` now
- Run `/build #<number>` now
- Just show the recommendation (do not start work)

Pre-select the option that matches your recommendation.

## Rules

### DO:
- Base the recommendation on signals from both the issue text and the codebase probe
- Explain exactly why you picked the recommendation — the user must be able to override intelligently
- Always offer selectable options; never auto-start a pipeline

### DO NOT:
- Start any work (branching, coding, commits) — this skill is recommendation-only
- Recommend `/build` because the issue body is long — verbosity is not a complexity proxy
- Skip the codebase probe — an issue that sounds simple may touch many files
- Recommend `/hotfix` if any design decision is open, even a small one
