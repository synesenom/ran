# Release Skill

You are cutting a versioned release of ranjs: bumping the version, updating
the changelog, creating and merging a release PR, pushing the git tag that
triggers npm publish, and rotating the GitHub milestone.

## Invocation

```
/release [version]
```

Optional `version` argument — the exact semver to release, e.g. `1.25.0`. If
omitted, the version is computed by bumping the minor part of the current
`package.json` version (`1.24.6` → `1.25.0`).

## Pre-conditions

- `gh` CLI must be installed and authenticated (`gh auth status`)
- Must be on `main` with a clean working tree
- Network access to GitHub and npm must be available

## Workflow

### 1. Pre-flight

```bash
gh auth status
git status --short        # must be empty
git branch --show-current # must be 'main'
git pull origin main
```

Abort with a clear error message if any check fails.

---

### 2. Determine version

```bash
CURRENT=$(node -p "require('./package.json').version")
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
```

**If a `version` argument was provided**, use it as `VERSION` directly.

**Otherwise, default to a minor bump**: `X.Y.Z` → `X.(Y+1).0`.

Under the numpy/scipy-style versioning policy, **breaking changes ship in
minor releases** (behind a deprecation cycle), so the `breaking` label does
**not** trigger a major bump. A major bump (`X.Y.Z` → `(X+1).0.0`) is reserved
for a rare, sweeping overhaul and is only ever done by passing an explicit
`version` argument — never inferred automatically from issue labels.

Surface any `breaking`-labelled issues closed since the last tag so the
operator is aware of behavior changes in this minor release (informational
only — it does not change the bump type):

```bash
if [ -n "$LAST_TAG" ]; then
  LAST_TAG_DATE=$(git log -1 --format=%cI "$LAST_TAG")
  BREAKING_CLOSED=$(gh issue list \
    --state closed \
    --label breaking \
    --json number,closedAt,title \
    --jq ".[] | select(.closedAt > \"$LAST_TAG_DATE\") | \"#\(.number) \(.title)\"")
fi
```

Compute `NEXT_VERSION` (the milestone to create after this release):
- Any release `X.Y.0` → next is `X.(Y+1).0`

Print `VERSION`, the bump type, any `breaking`-labelled issues in the release,
and `NEXT_VERSION` so the operator can confirm before continuing.

---

### 3. Show what's in the release

```bash
if [ -n "$LAST_TAG" ]; then
  CHANGES=$(git log "${LAST_TAG}..HEAD" --oneline --no-merges)
else
  CHANGES=$(git log --oneline --no-merges)
fi
echo "$CHANGES"
```

Display the commit list. If it is empty, warn and ask the operator whether to
continue.

---

### 4. Create release branch

```bash
git checkout -b "release/v${VERSION}"
```

---

### 5. Update version files

**`package.json` + `package-lock.json`** — update both atomically:

```bash
npm version "${VERSION}" --no-git-tag-version
```

**`CHANGELOG.md`** — replace the `## [Unreleased]` heading with the versioned
heading and prepend a fresh empty `[Unreleased]` section above it:

```
## [Unreleased]

## [1.25.0] - 2026-05-18
```

Use today's date in `YYYY-MM-DD` format. Do not alter any other content in
the file.

---

### 6. Commit and push

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "Release v${VERSION}"
git push -u origin "release/v${VERSION}"
```

---

### 7. Create PR

```bash
PR_URL=$(gh pr create \
  --title "Release v${VERSION}" \
  --base main \
  --body "$(cat <<EOF
## Release v${VERSION}

### Changes since ${LAST_TAG:-initial commit}

${CHANGES}

---
*Automated release PR — do not add commits to this branch.*

https://claude.ai/code/session_01NNVzrusD7ynZgfa1ZEP2wC
EOF
)")
echo "PR: ${PR_URL}"
```

---

### 8. Merge PR

```bash
gh pr merge --merge --auto
```

Poll until merged (5-minute timeout, 5-second interval):

```bash
for i in $(seq 1 60); do
  STATE=$(gh pr view --json state -q '.state')
  [ "$STATE" = "MERGED" ] && break
  if [ "$i" -eq 60 ]; then
    echo "ERROR: Timed out waiting for PR to merge. Merge it manually, then"
    echo "       run: git checkout main && git pull && git tag v${VERSION} && git push origin v${VERSION}"
    exit 1
  fi
  sleep 5
done
```

---

### 9. Tag the release

```bash
git checkout main
git pull origin main
git tag "v${VERSION}"
git push origin "v${VERSION}"
```

This push triggers `.github/workflows/release.yml` (lint → typecheck → tests →
`npm publish --provenance`).

---

### 10. Milestone rotation

```bash
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')

CURRENT_MS=$(gh api "repos/${REPO}/milestones" \
  --jq ".[] | select(.title == \"v${VERSION}\") | .number")

if [ -z "$CURRENT_MS" ]; then
  echo "Warning: milestone v${VERSION} not found — skipping milestone rotation."
else
  # Create the next milestone before moving issues so the target exists
  if gh api "repos/${REPO}/milestones" --jq '.[].title' | grep -qx "v${NEXT_VERSION}"; then
    echo "Milestone v${NEXT_VERSION} already exists — skipping create."
  else
    gh api "repos/${REPO}/milestones" \
      -X POST \
      -f title="v${NEXT_VERSION}" \
      -f description="Next release — bug fixes, new distributions, and non-breaking changes"
  fi

  # Move all open issues from the released milestone to the next one
  OPEN_ISSUES=$(gh issue list \
    --milestone "v${VERSION}" \
    --state open \
    --limit 200 \
    --json number \
    --jq '.[].number')

  MOVED=0
  for NUM in $OPEN_ISSUES; do
    gh issue edit "$NUM" --milestone "v${NEXT_VERSION}"
    MOVED=$((MOVED + 1))
  done

  # Close the released milestone
  gh api "repos/${REPO}/milestones/${CURRENT_MS}" \
    -X PATCH \
    -f state=closed

  echo "Milestone v${VERSION}: closed (${MOVED} open issues moved to v${NEXT_VERSION})"
  echo "Milestone v${NEXT_VERSION}: ready"
fi
```

Note: only the milestone whose title matches `v${VERSION}` is closed and
rotated. Any future major-overhaul milestone, if one is ever created, is left
untouched by this skill.

---

### 11. Report

End with a concise summary:

```
Released:  v{VERSION}
Tag:       v{VERSION} → triggers npm publish via CI
PR:        {PR_URL}

Milestone v{VERSION}:      closed  ({N} open issues moved)
Milestone v{NEXT_VERSION}: created
```

## Rules

- **Abort if pre-flight fails** — never release from a dirty tree or a
  non-main branch
- **Never skip the tag push** — without it, `release.yml` never fires and
  nothing is published to npm
- **Milestone rotation is best-effort** — if the milestone is missing, warn
  and continue; do not abort the release
- **Only touch the released milestone** — leave any future major-overhaul
  milestone untouched when releasing a minor version
- **No interactive prompts mid-pipeline** — if anything is ambiguous, abort
  early with a clear message rather than pausing mid-release
