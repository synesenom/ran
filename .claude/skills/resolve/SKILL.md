# Resolve Skill

You are triaging a GitHub issue to pick and launch the fastest, safest workflow: `/hotfix`, `/fix`, or `/build`.

## Core Principle

Match the issue's complexity to the right pipeline. Picking too lightweight a skill (e.g., `/hotfix` for something that needs design decisions) wastes time when the pipeline hits a wall mid-flow. Picking too heavy a skill (e.g., `/build` for a one-liner) slows delivery unnecessarily. This skill reads the issue, does a lightweight codebase probe to produce a confident recommendation, and then automatically launches that recommended skill — no manual selection step. When no issue is named, it also picks *which* issue from the open backlog before triaging it, using the same priority/difficulty ranking as `/next`.

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

When the user invokes `/resolve <number>` or bare `/resolve` (no issue given):

### 0. Pick an Issue (only when no `<number>` was given)

Skip straight to Step 1 if the user passed a number or URL.

Otherwise, select the top candidate from the open backlog using the **same ranking as `/next`**: priority tier desc (high > medium > low > unlabeled), then difficulty desc (trivial > moderate > difficult > unlabeled) as the tiebreak, then issue number asc. Do not invent a different ranking — reuse this one so `/resolve` and `/next` never disagree on what "next" means.

1. Run `python3 .claude/skills/next/rank_issues.py` and take `ranked[0]` (the top of the unblocked list; entries in `blocked` are excluded — never pick a blocked issue).
   - **`gh` unavailable:** fall back to `mcp__github__list_issues` (`state: OPEN`, paginate via `after`/`pageInfo` until exhausted), extract each issue's priority/difficulty labels, and rank them in memory using the same rule above (skip dependency/`blocked` detection in this fallback — priority and difficulty alone are enough).
2. If there are no open issues (or every open issue is blocked in the script path), stop and report: "No open, unblocked issues found — nothing to resolve."
3. Report the pick before continuing:
   > "No issue given — picking from the backlog: **#\<number\> — \<title\>** (priority: \<p\>, difficulty: \<d\>)."
4. Continue to Step 1 using this issue's number.

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

### 5. Launch the Recommended Skill

Immediately after presenting the recommendation, invoke the recommended skill via the Skill tool, passing the issue number/URL as its argument (e.g. recommended `/build` on issue #123 → invoke `build` with argument `123`). Do not pause for confirmation and do not ask the user to pick — the whole point of this skill is to remove that manual step.

> "Launching `/hotfix` for #\<number\> based on the signals above."

Then invoke the skill and let it run its own workflow (branching, coding, tests, review, ship) to completion. `/resolve`'s job ends once the child skill has been launched — do not duplicate or second-guess its internal steps.

**Exception — genuine toss-up:** if, after the codebase probe, the signals are still evenly split between two skills (not merely "could go either way with a slight lean" — actually balanced), apply the tiebreaker rules first. Only if the tiebreaker itself doesn't resolve it (which should be rare), stop and ask the user with `AskUserQuestion` instead of guessing. This is the sole case where `/resolve` pauses.

## Rules

### DO:
- Base the recommendation on signals from both the issue text and the codebase probe
- Explain exactly why you picked the recommendation before launching it
- Auto-launch the recommended skill via the Skill tool — do not wait for user approval
- When no issue is given, reuse `/next`'s exact ranking (priority tier, then difficulty) instead of inventing a new one

### DO NOT:
- Recommend `/build` because the issue body is long — verbosity is not a complexity proxy
- Skip the codebase probe — an issue that sounds simple may touch many files
- Recommend `/hotfix` if any design decision is open, even a small one
- Ask the user to choose when the tiebreaker rules already resolve the ambiguity — only escalate on a genuine, unresolved toss-up
- Pick a blocked issue (one with open, unresolved dependencies) when auto-selecting from the backlog
