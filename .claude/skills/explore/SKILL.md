# Explore Command

You are doing free-form exploration of a statistical or mathematical topic by combining web research with codebase analysis, documenting findings in a structured exploration note.

## Core Principle

No planning, no tests, no approval needed — just explore, learn, and document findings. This is for understanding a topic before committing to an implementation approach.

## Workflow

When the user invokes `/explore <argument>`:

The `<argument>` is a GitHub issue (`#42`, `42`, or URL) or a plain topic string (e.g., `Confluent hypergeometric function`).

### 1. Resolve Input

**If the argument is a GitHub issue:**
- Run `gh issue view <number-or-url>` (or `mcp__github__issue_read`)
- Extract the topic and intent from the issue
- Derive a slug: `<issue-number>-<slugified-title>` (lowercase, kebab-case)
- **Create a development branch**:
  ```bash
  git checkout main
  gh issue develop <issue-number> --name <branch-name> --checkout
  ```
  **`gh` unavailable:** create locally: `git checkout -b <issue-number>-<slug>`

**If the argument is a plain topic:**
- Use the topic string as the research question
- Derive a slug: `<slugified-topic>`
- Stay on the current branch — do not create a new one

### 2. Research the Topic

Use **WebSearch** and **WebFetch** to learn about the topic. Focus on:
- Mathematical definition and formulas (PDF, CDF, moments for distributions)
- Authoritative references (DLMF, NIST Digital Library of Mathematical Functions, Wikipedia)
- Relevant algorithms or numerical methods
- How the topic connects to the existing codebase (check `src/` as needed)
- Known edge cases, numerical pitfalls, or implementation challenges

Use 3–6 targeted searches. Prefer depth over breadth.

### 3. Explore the Codebase

- Search for related existing implementations using Glob and Grep
- Read a few related distributions or functions to understand patterns
- Identify what prerequisites (special functions, algorithms) would be needed
- Note any potential conflicts or interactions with existing code

### 4. Write the Exploration Document

Create `thoughts/exploration/YYYY-MM-DD-HHmm-<slug>.md`:

```markdown
---
date: <ISO timestamp>
topic: "<topic>"
github_issue: <number, if from a GitHub issue — omit otherwise>
status: complete
---

# Exploration: <topic>

**Date**: <timestamp>
**Branch**: <branch or N/A>

## What This Explores

<1-2 sentences on what this topic is and why it's interesting for ranjs>

## Mathematical Background

<Key concepts, definitions, and formulas from research.
Include the canonical PDF/CDF formulas for distributions, citing sources.
Use LaTeX-style math in code blocks for complex formulas.>

```
PDF: f(x; params) = ...
CDF: F(x; params) = ...
Support: x ∈ [a, b]
```

## Key Properties

- <Property 1: moments, special cases, relationships to other distributions>
- <Property 2: ...>
- <Parameter constraints: ...>

## Implementation Notes

### Prerequisites
- <Special functions needed: e.g., `betaIncomplete` — already in `src/special/`>
- <Algorithms needed: e.g., numerical inversion — already in `src/algorithms/`>

### Existing Related Code
- `src/dist/<related>.js:line` — <how it's related>
- `src/special/<function>.js:line` — <available function>

### Numerical Considerations
- <Overflow/underflow risks and how to address them>
- <Recommended sampling algorithm>
- <Any known edge cases>

## Example Usage (Conceptual)

```js
const d = new ran.dist.NewDistribution(param1, param2)
d.pdf(1.5)   // ~0.xxx
d.sample(10) // [...]
```

## Open Questions

- <Decision 1: e.g., which sampling algorithm to use?>
- <Decision 2: e.g., should param X allow zero?>

## Sources

- [Source Title](https://url)
- [NIST DLMF §XX.YY](https://dlmf.nist.gov/...)
```

### 5. Present to User

> "Exploration complete: <title or topic>
>
> <If from issue:> Branch: `<branch-name>`
> Document: `thoughts/exploration/YYYY-MM-DD-HHmm-<slug>.md`
>
> What I explored:
> - <Topic 1>
> - <Topic 2>
>
> Key findings:
> - <Finding 1>
> - <Finding 2>
>
> Open questions / next steps:
> - <Question or follow-up>
>
> Ready to plan? Use: `/plan #<number>` or `/plan <topic> — see thoughts/exploration/<file>.md`"

## Rules

### DO:
- Go deep on the mathematics — this is the most valuable part for a statistics library
- Document formulas precisely with citations
- Note numerical pitfalls explicitly
- Identify what already exists vs. what needs to be built

### DO NOT:
- Write unit tests or production code
- Follow the implementation plan format
- Ask for approval before writing the document
- Create any files other than the exploration document
