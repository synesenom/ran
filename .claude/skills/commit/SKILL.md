# Commit Command

You are creating a git commit for the current staged and unstaged changes with an AI-generated commit message.

## Core Principle

Write commit messages that explain *why* the change was made, not just *what* changed. Follow the repository's commit style strictly.

## Commit Message Style Guide

This repository uses a specific commit message style. Follow these rules exactly:

- **Single line only** — no body paragraph, no multi-line messages
- **Sentence case** — capitalize the first word, lowercase the rest (e.g., "Methods re-ordered")
- **Past tense or passive voice** — e.g., "Distribution added", "Bug in CDF fixed", "Formula corrected"
- **Short and descriptive** — typically 3-7 words
- **No period** at the end
- **No prefix convention** (no "fix:", "feat:", "chore:", etc.)

**Good examples**:
- `LogNormal distribution added`
- `Off-by-one in discrete CDF fixed`
- `Neumaier sum used for numerical stability`
- `Gamma special function extracted to own module`
- `Missing parameter constraint added`
- `Quantile inversion replaced with Brent root-finding`

**Bad examples**:
- `fix: correct CDF formula` (wrong — no conventional commit prefixes)
- `Fix the CDF formula` (wrong — imperative mood)
- `lognormal distribution added` (wrong — not capitalized)
- `LogNormal distribution added.` (wrong — has a period)

## Workflow

When the user invokes `/commit`:

### 1. Gather Context

Run in parallel:
- `git status` — see all staged, unstaged, and untracked files
- `git diff` — see unstaged changes
- `git diff --staged` — see staged changes
- `git log --oneline -10` — recent commit messages for style reference

If there are no changes, stop: "Nothing to commit — working tree is clean."

### 2. Stage All Changes

Stage all current changes — do not ask the user what to stage.

- Do NOT stage files that likely contain secrets (`.env`, credentials, etc.) — warn the user and skip those files

### 3. Review the Diff

Read the full diff of what will be committed. Understand:
- What files were modified, added, or deleted
- The nature of the changes (new distribution, bug fix, refactor, docs, test, etc.)

### 4. Generate Commit Message

Follow the **Commit Message Style Guide** above exactly. Match the tone and format of recent commits.

### 5. Stage and Commit

Stage specific files by name (not `git add -A` or `git add .`):
```bash
git add <file1> <file2> ...
```

Commit using a HEREDOC:
```bash
git commit -m "$(cat <<'EOF'
<commit message>
EOF
)"
```

### 6. Verify and Report

Run `git status` after the commit to verify success, then report:

> "Committed: `<short hash>` <commit message>
>
> Files: <count> changed
> Branch: `<branch name>`"

## Rules

### DO:
- Read the FULL diff before writing the commit message
- Follow the Commit Message Style Guide exactly
- Stage files by name, not with blanket `git add .`
- Warn about sensitive files before staging

### DO NOT:
- Commit if there are no changes
- Use `git add -A` or `git add .`
- Amend previous commits unless explicitly asked
- Push to remote — only commit locally
- Use imperative mood — this repo uses past tense/passive voice
