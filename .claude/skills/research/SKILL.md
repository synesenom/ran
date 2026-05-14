# Research Command

You are conducting comprehensive codebase research to document what exists without suggesting changes.

## Core Principle

ONLY document what exists — DO NOT suggest changes, improvements, or critiques.

## Workflow

When the user invokes `/research <topic>`:

### 1. Understand the Research Question

- Read the user's query carefully
- **If the query contains a GitHub issue URL** or a short reference (e.g. `#123`):
  - Fetch the issue details using: `gh issue view <number-or-url>` (or `mcp__github__issue_read` if `gh` is unavailable)
  - Use the issue title and body as the research question / context
  - Include the issue number in the research document frontmatter as `github_issue: <number>`
  - **Create a development branch** (only when invoked standalone — when invoked from `/build`, the branch already exists):
    1. Check the current branch: `git branch --show-current`
    2. If the branch name already starts with the issue number, **skip branch creation**
    3. Otherwise, derive the branch name: `<issue-number>-<slugified-issue-title>` (lowercase, kebab-case)
    4. Switch to `main`: `git checkout main`
    5. Create a linked branch: `gh issue develop <issue-number> --name <branch-name> --checkout`
    6. **`gh` unavailable:** use `mcp__github__issue_read` to fetch the issue and create the branch locally with `git checkout -b <issue-number>-<slug>`.
- Otherwise, identify what the user wants to understand about the codebase

### 2. Spawn Parallel Sub-Agents

If needed for broad searches, spawn these agents in parallel:
- **discovery-code** agent — to find relevant files
- **discovery-analyze** agent — for deep analysis of how code works

### 3. Web Research (when needed)

If the research topic involves **external concepts** — statistical distributions, mathematical formulas, numerical algorithms, external references (DLMF, NIST, Wikipedia distribution articles) — use **WebSearch** and **WebFetch** tools to gather context.

**When to do web research:**
- The topic references a distribution not yet in the codebase (find the canonical PDF/CDF formulas)
- The topic involves a numerical algorithm or special function from the literature
- The topic references a statistical test with a specific reference distribution
- The user explicitly asks for external context

**When NOT to do web research:**
- The topic is purely about internal codebase structure or data flow
- The answer is fully derivable from reading the code

### 4. Gather Codebase Information

- Search for relevant files using Glob and Grep tools
- Read and understand key code sections
- Trace data flows and component interactions
- Document patterns and conventions

### 5. Produce Research Document

Create a structured markdown file at:
`thoughts/research/YYYY-MM-DD-HHmm-<topic-slug>.md`

Use this format:

```markdown
---
date: <ISO timestamp>
topic: "<user's research question>"
github_issue: <number, if sourced from a GitHub issue — omit otherwise>
status: complete
---

# Research: <topic>

**Date**: <timestamp>
**Repository**: ranjs
**Branch**: <current branch>

## Research Question

<Original user query, or issue title + body if sourced from GitHub>

## Summary

<High-level findings - 2-3 paragraphs answering the question>

## Detailed Findings

### Component 1: <name>

- **Location**: `src/dist/log-normal.js:23-45`
- **Purpose**: What this component does
- **Key Details**: Important implementation details
- **Connections**: How it connects to other components

### Component 2: <name>

<Similar structure>

## Information Flow

<Diagram or description of how data/control flows through the system>

## Patterns & Conventions

- Pattern 1: Description with examples
- Pattern 2: Description with examples

## Key Files Reference

- `src/dist/_distribution.js` — Base Distribution class
- `src/algorithms/brent.js` — Brent root-finding (used for quantile)
- `src/special/gamma.js` — Gamma function

## External Context

<If web research was performed, summarize key findings here.
Include canonical formulas with citations. Omit if no web research was needed.>

## Sources

<List of external URLs consulted. Omit if no web research was needed.>

- [Source Title](https://example.com)

## Questions for Planning Phase

<Any open questions that need human decision in planning>
```

### 6. Present to User

> "I've completed the research on [topic]. The findings are documented at:
>
> `thoughts/research/YYYY-MM-DD-HHmm-<topic>.md`
>
> Branch: `<branch-name>` (if created from a GitHub issue)
>
> Key findings:
> - <Key finding 1>
> - <Key finding 2>
> - <Key finding 3>
>
> Please review the research document. When you're ready to create a plan, use:
> `/plan <description> — see thoughts/research/YYYY-MM-DD-HHmm-<topic>.md`"

## Rules

### DO:
- Describe what IS, not what SHOULD BE
- Provide precise file:line references
- For new distributions: document the canonical PDF/CDF formula from authoritative sources
- Save everything to `thoughts/research/`

### DO NOT:
- Suggest improvements or changes
- Perform root cause analysis
- Propose future enhancements
- Include subjective opinions or critiques
