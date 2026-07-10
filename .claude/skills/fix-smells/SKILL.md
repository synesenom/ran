# Fix Smells Skill

You are eliminating all code smells in a single file using CodeScene's Code Health analysis as your guide.

## Core Principle

Use CodeScene's MCP tools to diagnose, fix, and verify code health in a single file. Fix smells one at a time, verify the score improves after each, and keep only fixes that either improve the score or leave it unchanged while genuinely cleaning up the code. Never change observable behavior — only internal structure, naming, and organisation.

## When to Use

Use this skill when:
- A file has a Code Health score below 10.0
- You want to systematically eliminate all code smells in a specific file
- The CLAUDE.md "Code Health" rule triggers (score below 10.0 after an edit)

## Workflow

When the user invokes `/fix-smells <file>`:

### 1. Resolve the File

- If the argument is a relative path, resolve it against the repo root (`/home/user/ran/<arg>`)
- If no argument is provided, report usage and stop: "`/fix-smells <file>` — pass the path to the file to clean"

### 2. Baseline Measurement

Call `mcp__codescene__code_health_score` on the file and record the score.

If the score is **10.0**, report:

> "File is already at optimal Code Health (10.0). Nothing to fix."

…and stop.

### 3. Get Detailed Review

Call `mcp__codescene__code_health_review` on the file. Parse the returned output to produce a numbered list of smells, ordered by impact (highest-penalty smells first). For each smell note:
- Category (e.g. "Complex Method", "Deep, Nested Complexity", "Bumpy Road Ahead", "Large Method", etc.)
- Location (function/method name and line range if given)
- CodeScene's guidance for fixing it

Report the smell list as a progress checklist:

> **Baseline: <score> — <N> smell(s) identified**
>
> - [ ] 1. `<category>` — `<location>` (<guidance summary>)
> - [ ] 2. …

### 4. Fix Smells (Iterative Loop)

Work through the smell list top-to-bottom. For **each** smell:

**a. Read the affected code**
Use `Read` on the relevant section of the file (include enough surrounding context to understand the full function/block).

**b. Plan the minimal fix**
Apply CodeScene's guidance. Typical fixes by category:
- **Complex Method / Deep, Nested Complexity**: extract inner logic into helper functions with clear names; flatten guard clauses with early returns
- **Bumpy Road Ahead**: invert conditions and return early to eliminate nesting levels
- **Large Method**: extract cohesive sub-steps into named helpers
- **Primitive Obsession**: introduce a descriptive variable or constant for repeated magic literals
- **Missing Error Handling**: add the minimal guard or throw specified by the project's error conventions
- **Duplicated Code**: extract shared logic into a single named helper and call it from both sites

Only fix the targeted smell. Do not clean surrounding code speculatively.

**c. Apply the fix**
Use the `Edit` tool. Keep diffs minimal.

**d. Lint check**
```bash
npm run standard
```
If linting fails, revert the fix with `Edit` and mark the smell as `SKIPPED (lint fail)`.

**e. Score check**
Call `mcp__codescene__code_health_score` again. If the score **regressed**, revert the fix with `Edit` and mark the smell as `SKIPPED (score regressed)`.

**f. Update the checklist** — mark the smell `[x]` (fixed) or `[ ] SKIPPED`.

### 5. Full Test Suite

After all smells are processed, run:
```bash
npm run standard
npm test
```

**If tests fail**: use `git diff` to identify all applied fixes, then bisect manually — revert the most recent fix and re-run `npm test` until the suite is green. Mark reverted fixes as `SKIPPED (test regression)`.

### 6. Final Measurement

Call `mcp__codescene__code_health_score` and `mcp__codescene__code_health_review` one final time to confirm the achieved score and any remaining smells.

### 7. Report

> **Code Health: `<file>`**
>
> Score: <baseline> → <final>
>
> Fixed (<N>):
> - `<category>` at `<location>` — <one-line description of what changed>
>
> Skipped (<M>):
> - `<category>` at `<location>` — <reason: lint fail / score regressed / test regression / out of scope>
>
> Remaining smells: <0 / list if any>
>
> Tests: All passing

## Rules

### DO:
- Fix smells in impact order — highest-penalty first
- Verify the score with `mcp__codescene__code_health_score` after **every** individual fix
- Revert any fix that regresses the score or breaks tests
- Follow the project's error and return-value conventions when adding guards
- Run `npm run standard` after each fix — catch style regressions immediately
- Update `CHANGELOG.md` under `## [Unreleased] → ### Changed` with a one-liner if the final score improved (e.g., "Code Health of `src/foo.js` improved from 7.4 → 9.1")

### DO NOT:
- Change observable behavior — no renamed public APIs, no altered return values, no changed parameter signatures
- Inline tests, docs, or comments as part of the smell fix (those are separate concerns)
- Refactor across multiple files — scope is the single target file only
- Skip the final `npm test` run
- Report a smell as fixed without confirming the score did not regress
