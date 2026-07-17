# Fix Smells Skill

You are eliminating all code smells in a target file using CodeScene's Code Health analysis as your guide.

## Core Principle

Use CodeScene's MCP tools to diagnose, fix, and verify code health in the target file. Fix smells one at a time, verify the score improves after each, and keep only fixes that either improve the score or leave it unchanged while genuinely cleaning up the code. Never change observable behavior — only internal structure, naming, and organisation.

The default scope is the single target file. But some smells cannot be fixed correctly within one file — a "God File" doing too many unrelated things needs to be **split** into smaller files; logic **duplicated across files** needs to be **merged** into one shared implementation; extracting a helper may only make sense in a **new sibling file**. When the smell genuinely requires it, you are allowed to create new files, split the target file into smaller ones, merge it with another file, or edit other files (e.g. import sites, namespace `index.js` re-exports). This is a last resort driven by what CodeScene's review actually recommends — not a general license to refactor unrelated files. Keep the blast radius as small as the smell demands and no smaller.

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
- Category (e.g. "Complex Method", "Deep, Nested Complexity", "Bumpy Road Ahead", "Large Method", "God Class"/"God File", "Duplicated Code", etc.)
- Location (function/method name and line range if given)
- CodeScene's guidance for fixing it
- Whether the guidance implies a **multi-file fix** (splitting the file, merging with another, or touching call sites) — flag these explicitly so the plan step can scope them correctly

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
- **Duplicated Code (within file)**: extract shared logic into a single named helper and call it from both sites
- **Duplicated Code (across files)**: extract the shared logic into one file (a new helper file, or one of the existing duplicate sites promoted to canonical) and have every other site import it — see "Multi-file fixes" below
- **God Class / God File (too many responsibilities)**: split the file into cohesive smaller files along its natural seams (e.g. one file per responsibility/section) — see "Multi-file fixes" below

Only fix the targeted smell. Do not clean surrounding code speculatively. Prefer a single-file fix whenever one exists; reach for a multi-file fix only when CodeScene's guidance (or the smell itself, e.g. a file mixing unrelated concerns) genuinely requires it.

**c. Apply the fix**
Use the `Edit` tool for single-file changes. For a fix that requires splitting, merging, or creating files, follow "Multi-file fixes" below before proceeding. Keep diffs minimal — extract only what the smell demands.

**d. Lint check**
```bash
npm run standard
```
Run across the whole repo (the default), which also catches stale imports in files you didn't directly edit. If linting fails, revert the fix (`Edit`, or `git checkout --` / delete for newly created files) and mark the smell as `SKIPPED (lint fail)`.

**e. Score check**
Call `mcp__codescene__code_health_score` again — on the original target file, and on every file the fix touched or created. If **any** touched file's score **regressed** relative to its own baseline (or a newly created file scores below 10.0 for a trivial extraction), revert the whole fix and mark the smell as `SKIPPED (score regressed)`.

**f. Update the checklist** — mark the smell `[x]` (fixed) or `[ ] SKIPPED`.

#### Multi-file fixes

When a smell requires touching more than the target file:

- **Splitting a file**: create new file(s) following the project's naming conventions (kebab-case filenames, `_` prefix for module-private files per CLAUDE.md). Move the relevant code verbatim where possible. If the original file is re-exported by a namespace `index.js` (e.g. `src/dist/index.js`), update it so the public import paths and named exports are unchanged unless the user explicitly asked for an API change. Grep the repo for every other file importing the original path and update those imports.
- **Merging files**: fold the duplicate/obsolete file's content into the canonical file, delete the obsolete file, and grep the repo for every import of the deleted file's path — redirect each to the merged location.
- **Touching call sites**: if a helper's signature or location changes, update every caller found via `Grep`, not just the ones in the target file.
- Never change the observable public API (exported names, function signatures, return values) as a side effect of a multi-file fix — a smell fix is internal restructuring, not a breaking change. If the smell cannot be fixed without an API change, skip it and note that in the report instead of making the change silently.

### 5. Full Test Suite

After all smells are processed, run:
```bash
npm run standard
npm test
```

**If tests fail**: use `git status` / `git diff` to identify all applied fixes (including any created, split, merged, or deleted files), then bisect manually — revert the most recent fix (and any files it introduced) and re-run `npm test` until the suite is green. Mark reverted fixes as `SKIPPED (test regression)`.

### 6. Final Measurement

Call `mcp__codescene__code_health_score` and `mcp__codescene__code_health_review` one final time on the original target file **and on every file created, split into, or merged as part of the fixes**, to confirm the achieved score(s) and any remaining smells.

### 7. Report

> **Code Health: `<file>`**
>
> Score: <baseline> → <final>
>
> Files touched: <original file> (+ any created/split/merged files, or "none — single-file only")
>
> Fixed (<N>):
> - `<category>` at `<location>` — <one-line description of what changed, noting any other files involved>
>
> Skipped (<M>):
> - `<category>` at `<location>` — <reason: lint fail / score regressed / test regression / would break public API / out of scope>
>
> Remaining smells: <0 / list if any>
>
> Tests: All passing

## Rules

### DO:
- Fix smells in impact order — highest-penalty first
- Default to a single-file fix; only split, merge, or create files when the smell genuinely requires it
- Verify the score with `mcp__codescene__code_health_score` after **every** individual fix, on every file that fix touched or created
- Revert any fix that regresses the score (on any touched file) or breaks tests
- When splitting or merging files, update the namespace `index.js` and every importer found via `Grep` so the public API surface is unchanged
- Follow the project's error and return-value conventions when adding guards
- Follow the project's file naming conventions (kebab-case, `_` prefix for module-private files) for any new file
- Run `npm run standard` after each fix — catch style regressions immediately, including stale imports in files outside the target
- Update `CHANGELOG.md` under `## [Unreleased] → ### Changed` with a one-liner if the final score improved (e.g., "Code Health of `src/foo.js` improved from 7.4 → 9.1"), naming any file split/merge involved

### DO NOT:
- Change observable behavior — no renamed public APIs, no altered return values, no changed parameter signatures, even when a fix spans multiple files
- Inline tests, docs, or comments as part of the smell fix (those are separate concerns)
- Touch files outside the smell's actual footprint — multi-file changes are allowed only when the smell itself spans files (a God File split, a cross-file duplication merge, updating call sites for a moved helper), never as a general excuse to refactor unrelated files
- Skip the final `npm test` run
- Report a smell as fixed without confirming the score did not regress on every file involved
