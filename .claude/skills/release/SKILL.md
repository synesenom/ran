# Release Skill

You are cutting a versioned release of ranjs: bumping the version, updating
the changelog, creating and merging a release PR, and handing off to the
GitHub Actions release workflow which tags, publishes to npm, cuts the GitHub
release, and rotates the milestone.

This skill runs **entirely through GitHub MCP tools** — it needs neither the
`gh` CLI nor a local git tag push. Everything the skill cannot do from an
MCP-only environment (create the `v*` tag, `npm publish`, cut the GitHub
release, rotate the milestone) is done server-side by
`.github/workflows/release.yml`, which the skill triggers via
`mcp__github__actions_run_trigger`. See
`decisions/0037-mcp-orchestrated-release.md`.

## Invocation

```
/release [version]
```

Optional `version` argument — the exact semver to release, e.g. `1.31.0`. If
omitted, the version is computed by bumping the minor part of the current
`package.json` version (`1.30.0` → `1.31.0`).

## Pre-conditions

- GitHub MCP tools available (`mcp__github__*`).
- `NPM_TOKEN` secret configured in repo Settings → Secrets → Actions (npm
  publish permission).
- `RELEASE_TOKEN` secret configured — a fine-grained PAT owned by a repo admin
  (repo: this one, Contents: read+write). `github-actions[bot]` cannot be added
  to the `v*` tag-protection ruleset's bypass list, so the workflow uses this
  PAT (which authenticates as an admin, who is in the bypass list) solely to
  push the release tag. One-time setup.
- `main` must be the default branch and there must be no in-flight release PR
  or existing `v{VERSION}` tag.

Throughout, use these MCP tools with `owner` = the repo owner and `repo` = the
repo name (derive from the remote, e.g. `synesenom`/`ran`).

## Workflow

### 1. Pre-flight

- `mcp__github__list_pull_requests` (state `open`) — abort if a
  `Release v*` PR is already open.
- `mcp__github__get_tag` for `v{VERSION}` once VERSION is known — abort if it
  already exists.
- `mcp__github__list_commits` on `main` — note the latest commit; the release
  PR bases off it.

Abort with a clear message if any check fails.

---

### 2. Determine version

Read the current version from `package.json` (via `mcp__github__get_file_contents`
on `main`, or the local checkout if present).

**If a `version` argument was provided**, use it as `VERSION`.

**Otherwise, default to a minor bump**: `X.Y.Z` → `X.(Y+1).0`.

Under the numpy/scipy-style versioning policy, **breaking changes ship in
minor releases** (behind a deprecation cycle), so a `breaking` label does
**not** trigger a major bump. A major bump (`X.Y.Z` → `(X+1).0.0`) is reserved
for a rare, sweeping overhaul and is only ever done by passing an explicit
`version` argument.

Optionally surface `breaking`-labelled issues closed since the last release via
`mcp__github__search_issues` so the operator is aware of behavior changes
(informational only — it does not change the bump type).

Compute `NEXT_VERSION` = `X.(Y+1).0` (the milestone the workflow will create).

Print `VERSION`, the bump type, any `breaking` issues, and `NEXT_VERSION`.

---

### 3. Show what's in the release

Use `mcp__github__list_commits` on `main` since the last release to display the
commit list. If it is empty, warn and ask the operator whether to continue.

---

### 4. Create release branch

`mcp__github__create_branch` — create `release/v{VERSION}` from `main`.

---

### 5. Update version files

On the `release/v{VERSION}` branch, edit and stage (do not commit yet — bundle
with step 6 into one commit):

- **`package.json`** — set `"version"` to `VERSION`.
- **`package-lock.json`** — set both the top-level `"version"` and the
  `packages[""].version` to `VERSION` (keep them in sync so `npm ci` on the
  runner does not fail).

---

### 6. Consolidate CHANGELOG

**This is the step that stays in the skill's judgement** — the workflow only
reads the finished section. Rewrite `CHANGELOG.md`:

1. Replace the `## [Unreleased]` heading with `## [VERSION] - YYYY-MM-DD`
   (today's date) and prepend a fresh empty `## [Unreleased]` section above it.

2. **Write a one-paragraph Summary** immediately under the new
   `## [VERSION] - YYYY-MM-DD` heading (before `### Added`), set off by blank
   lines. This is the first thing a reader sees on the GitHub release page: the
   workflow's notes extraction carries everything between the version heading
   and the next one, so the paragraph reaches the release page automatically
   with no workflow change. In 1–3 sentences, name the release's **dominant
   theme**, inferred from the entries you are about to consolidate:
   - One large feature/module dominates (a new namespace, a family of new
     distributions, a sampler suite) → lead with it by name, e.g. "This release
     exposes the `ran.mc` MCMC module as a first-class public API …".
   - Mostly corrections, no headline feature → frame it as a stability release,
     e.g. "A maintenance release focused on correctness and robustness fixes
     across …".
   - A broad additive mix → "A broad round of additive improvements spanning …".

   Keep it factual and specific — name the affected modules/areas, do not invent
   impact claims or restate every bullet. Derive it from the actual `### …`
   entries in this section, never from memory.

3. **Order subsections** in the new `## [VERSION]` section to the canonical
   Keep-a-Changelog sequence: `Added` → `Changed` → `Deprecated` → `Removed`
   → `Fixed` → `Security`. Drop any subsection with no bullets. Merge any
   duplicate subsections (e.g. two `### Added` blocks) into one.

4. **Merge grouped bullets.** Collapse multiple bullets describing the same
   logical change applied to several items into a single bullet that names all
   items. One bullet per logical change, not per file.

5. **Keep every distinct change.** Prefer a slightly longer list over a lossy
   summary. **Do not touch** anything below the new versioned heading.

Verify the file parses correctly (no duplicate headings; the only non-bullet
prose inside the version section is the leading Summary paragraph).

---

### 7. Commit release branch

Commit the step 5 + step 6 edits as a single commit `Release v{VERSION}` on
`release/v{VERSION}` using `mcp__github__push_files` (all files in one commit).

---

### 8. Create PR

`mcp__github__create_pull_request`:
- title: `Release v{VERSION}`
- base: `main`, head: `release/v{VERSION}`
- body: the commit list from step 3 plus a note
  `*Automated release PR — do not add commits to this branch.*`

Record the PR number and URL.

---

### 9. Merge PR

Wait for the PR's required checks to pass, then merge:

- Poll `mcp__github__pull_request_read` (and `mcp__github__get_check_run` if
  needed) until the PR is mergeable and checks are green (5-minute timeout,
  ~15-second interval).
- `mcp__github__merge_pull_request` with method `merge`.

If the merge is blocked or times out, stop and report — do not force it.

---

### 10. Trigger the release workflow

Once the PR is merged (the bumped `package.json` and consolidated `CHANGELOG.md`
are now on `main`), trigger the workflow:

- `mcp__github__actions_run_trigger` — `method` `run_workflow`, `workflow_id`
  `release.yml`, `ref` `main`, `inputs: { version: "VERSION" }`.

The workflow then, on the runner, does everything MCP cannot:

- creates and pushes the `v{VERSION}` tag,
- runs lint/typecheck/tests and `npm publish --provenance`,
- cuts the GitHub release with the consolidated `## [VERSION]` notes from
  `CHANGELOG.md`,
- rotates the milestone (creates `v{NEXT_VERSION}`, moves open issues, closes
  `v{VERSION}`),
- deletes the merged `release/v{VERSION}` branch (best-effort).

Poll `mcp__github__actions_list` / `mcp__github__actions_get` for the run and
report its conclusion. If the run fails on the tag step, the most likely cause
is a missing or under-scoped `RELEASE_TOKEN` secret (see Pre-conditions).

---

### 11. Report

End with a concise summary:

```
Released:  v{VERSION}
PR:        {PR_URL} (merged)
Workflow:  {RUN_URL} → tag, npm publish, GitHub release, milestone rotation
Milestone: v{VERSION} closed, v{NEXT_VERSION} created (by the workflow)
```

## Rules

- **All GitHub state changes go through MCP** — never assume `gh` or a local
  tag push is available.
- **Never skip the workflow trigger** — without step 10 nothing is tagged or
  published to npm. The merged PR alone publishes nothing.
- **Consolidate the changelog in the skill, not the workflow** — the semantic
  merge of grouped bullets is judgement the workflow cannot do; it only reads
  the finished `## [VERSION]` section.
- **Milestone rotation is best-effort** — the workflow warns and continues if
  the milestone is missing.
- **No interactive prompts mid-pipeline** — if anything is ambiguous, abort
  early with a clear message rather than pausing mid-release.
