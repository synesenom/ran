# Plan Command

You are creating a detailed implementation plan based on research findings.

## Core Principle

Transform research into ACTIONABLE, PHASED implementation steps with clear success criteria.

## Workflow

When the user invokes `/plan <description>`, `/plan <research-file>`, or `/plan <github-issue>`:

### 1. Resolve GitHub Issue (if applicable)

- **If the query contains a GitHub issue URL or reference** (e.g. `#123`):
  - Fetch the issue details using: `gh issue view <number-or-url>` (or `mcp__github__issue_read` if `gh` is unavailable)
  - Use the issue title and body as planning context
  - **Check the current branch** and create a development branch if needed (same logic as `/research`)

### 2. Gather Context

- Spawn the **discovery-thoughts** agent to find relevant prior work and past solutions
- If user references a research file, read it completely
- If past solutions are found, incorporate their prevention strategies into the plan
- If no research exists, spawn **discovery-code** and **discovery-analyze** agents to gather context
- Understand the goal and constraints

### 3. Auto-Resolve Design Decisions

Use a propose-critique agent loop to auto-resolve most decisions:

a. **Spawn design agents**:
   - Spawn the **design-propose** agent with the decision description and context
   - Wait for proposals, then spawn the **design-critique** agent with the proposals and original context

b. **Synthesize the result**:
   - **If both agents agree and confidence is High**: Auto-select the recommended option. Inform the user but do not wait for confirmation.
   - **If confidence is Low or agents disagree**: Escalate to the human with the options and the specific tradeoff.

c. **Report the outcome**:

   For auto-resolved decisions:
   > "**Design Decision (auto-resolved, high confidence):**
   >
   > Chose **<Option Name>** — <1 sentence reason>.
   > Critique confirmed: follows existing patterns, low testing burden.
   >
   > (Proceeding to plan structure.)"

   For escalated decisions:
   > "**Design Decision (needs your input):**
   >
   > **Option 1**: <Name> — <summary>
   > **Option 2**: <Name> — <summary>
   >
   > **Tradeoff**: <what the critique revealed>
   >
   > Which approach do you prefer?"

   Then wait for user input before proceeding.

### 4. Write ADRs for Design Decisions

Write an ADR only when the decision affects the `Distribution` base class public API, the module export structure, cross-cutting conventions, or introduces/removes a dependency. Do **not** write an ADR for implementation-technique choices within a single distribution (which algorithm to use, which special function to call, formula variants).

For each decision that clears the bar:

a. **Determine the next ADR number**: List files in `decisions/` and pick the next sequential number.

b. **Write the ADR** at `decisions/NNNN-<slug>.md`:

```markdown
# ADR-NNNN: <Decision Title>

**Date**: YYYY-MM-DD
**Status**: Accepted

## Context

<What motivated this decision>

## Decision

<What was chosen and why>

## Consequences

<What becomes easier or harder>
```

c. **Link the ADR** at the most relevant code location as a WHY comment:
   ```js
   // See decisions/NNNN-slug.md
   ```

### 5. Propose Plan Structure

> "Here's my proposed plan structure:
>
> ## Overview
> <1-2 sentence summary>
>
> ## Implementation Phases:
> 1. <Phase name> - <what it accomplishes>
> 2. <Phase name> - <what it accomplishes>
> ..."

Proceed directly to creating the plan without waiting for confirmation.

### 6. Create Implementation Plan

Create the plan at:
`thoughts/plans/YYYY-MM-DD-HHmm-<description-slug>.md`

Use this format:

```markdown
---
date: <ISO timestamp>
description: "<plan description>"
status: approved
related_research: "thoughts/research/YYYY-MM-DD-HHmm-<topic>.md"
---

# Implementation Plan: <description>

## Overview

<2-3 paragraph summary of what will be implemented and why>

## Design Decisions

- [ADR-NNNN: <title>](../../decisions/NNNN-slug.md) — <one-line summary>

<If no design decisions:>
No design decisions — straightforward implementation.

## Implementation Phases

### Phase 1: <Descriptive Name>

**Goal**: <What this phase accomplishes>

**Files to Modify**:
- `src/dist/<name>.js` — <What changes>
- `test/dist-cases.js` — <What test cases are added>

**Steps**:
1. [ ] <Specific action>
2. [ ] <Specific action>

**Success Criteria**:
- [ ] <Testable criterion>

**Verification**:
```bash
npm run standard
npm test
```

---

### Phase 2: <Descriptive Name>

<Similar structure>

---

## Testing Strategy

- New distributions: add entry to `test/dist-cases.js` with `invalidParams`, `params`, and `cases`
- Statistical correctness: verify PDF integrates to 1, CDF is monotone, quantile inverts CDF
- Edge cases: parameter boundaries, support boundaries, extreme inputs
- Verify: `npm test`

## Learnings from Past Solutions

<If discovery-thoughts found relevant solutions:>
- `<solution path>`: <key insight and how it applies>

<If none:>
No relevant past solutions found.

## Risk Assessment

- **High Risk**: <What could go wrong mathematically or numerically>
- **Medium Risk**: <What requires careful attention>
- **Low Risk**: <What is straightforward>

## Estimated Complexity

- **Lines of Code**: ~<estimate>
- **Files Modified**: ~<count>
```

### 7. Present to User

> "I've created the implementation plan at:
>
> `thoughts/plans/YYYY-MM-DD-HHmm-<description>.md`
>
> The plan includes:
> - <Phase 1 summary>
> - <Phase 2 summary>
>
> Once ready, start implementation with:
> `/implement thoughts/plans/YYYY-MM-DD-HHmm-<description>.md`"

## Rules

### DO:
- Use design-propose + design-critique agents for design decisions
- Auto-resolve high-confidence decisions; escalate low-confidence ones
- Break into logical, independently testable phases
- Call out exact files and what changes
- Make success criteria objective and verifiable

### DO NOT:
- Stop and ask the human about every design choice — use the agents first
- Create phases that can't be tested independently
- Treat plans as suggestions — they are specifications
- Include phases or steps that don't map to an acceptance criterion
- Propose adapting a statistical formula to use substitute inputs without first adding the required metric — statistical formulas have specific mathematical requirements that can't be silently substituted
