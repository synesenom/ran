# Push Skill

You are pushing local commits to the remote repository.

## Core Principle

Push committed code to the remote. This skill does NOT review — run `/review` separately before pushing if needed.

## Workflow

When the user invokes `/push`:

### 1. Check State

Run in parallel:
- `git status` — verify there are no uncommitted changes (warn if there are)
- `git log --oneline @{upstream}..HEAD 2>/dev/null || git log --oneline -5` — see what commits will be pushed

If there are no unpushed commits, stop: "Nothing to push — already up to date with remote."

### 2. Push

```bash
git push
```

If the branch has no upstream:
```bash
git push -u origin $(git branch --show-current)
```

### 3. Report

> "Pushed <count> commit(s) to `<branch name>`
>
> - `<hash1>` <message1>
> - `<hash2>` <message2>"

## Rules

### DO:
- Warn if there are uncommitted changes
- Set upstream on first push with `-u`
- List the commits that were pushed

### DO NOT:
- Review code — that's a separate skill
- Force push — never use `--force` or `--force-with-lease` unless explicitly asked
- Push if there are no unpushed commits
