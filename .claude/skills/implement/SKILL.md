# Implement Command

You are executing an approved implementation plan step-by-step.

## Core Principle

Execute the plan EXACTLY as specified, with testing and verification after each phase.

## Workflow

When the user invokes `/implement <plan-file-path>`:

### 1. Load and Validate Plan

- If user provides a **GitHub issue number** (e.g. `#111`):
  - Run `gh issue view <number>` (or `mcp__github__issue_read` if `gh` is unavailable)
  - Spawn the **discovery-thoughts** agent to find a related plan
  - If no plan found: tell the user to create one first
- If user provides a plan file path, read it directly
- If user just says "implement X": spawn **discovery-thoughts** to find the relevant plan
- Read the entire plan file and any progress document
- **Search for relevant past solutions** via **discovery-thoughts** — keep insights in mind to avoid repeating past mistakes
- Verify it's approved (status should be "approved")

### 2. Confirm with User

> "I've loaded the implementation plan from:
> `<plan-file-path>`
>
> The plan has <N> phases:
> 1. <Phase 1 name> - <goal>
> 2. <Phase 2 name> - <goal>
>
> <If past solutions were found:>
> **Relevant past learnings:**
> - <solution file>: <key insight>
>
> Executing immediately."

### 3. Execute Phase by Phase

For each phase, follow the **RED-GREEN-REFACTOR** cycle:

a. **Announce Phase Start**
   > "Starting Phase 1: <name>"

b. **RED — Write Failing Tests First**
   - For new distributions: add entry to `test/dist-cases.js` with `invalidParams`, `params`, and `cases` BEFORE writing any implementation
   - For other changes: write Mocha test(s) that assert the expected behavior before writing the implementation
   - Tests must encode expected behavior, not mirror implementation details

c. **Verify RED — Confirm Tests Fail**
   ```bash
   npm test
   ```
   - The NEW tests must FAIL
   - If new tests pass without implementation, they are not testing anything meaningful — rewrite them
   - Existing tests must still pass

d. **GREEN — Write Minimum Implementation**
   - Follow the plan's steps exactly
   - Write the minimum code needed to make the failing tests pass
   - For new distributions: implement `_pdf(x)`/`_pmf(x)` and `_cdf(x)` first, then add to `src/dist/index.js`
   - Do NOT add functionality beyond what the tests require

e. **Verify GREEN — Confirm All Tests Pass**
   ```bash
   npm run standard    # Standard.js linting
   npm test            # Mocha test suite
   ```
   - Both linting and tests must pass (new and existing)

f. **REFACTOR (if needed)**
   - Clean up the implementation while keeping all tests green
   - Move pre-computed constants to `this.c` if they're computed in hot paths
   - Re-run after any refactoring

g. **Update Plan with Progress**
   - Mark completed steps with [x]
   - Update success criteria checkboxes

h. **Report Phase Completion**
   > "Phase 1 Complete: <name>
   >
   > RED: <N> new tests written (confirmed failing)
   > GREEN: Implementation added (all tests passing)
   > REFACTOR: <what was cleaned up, or 'None needed'>
   >
   > Tests: PASSED
   >
   > Continuing to Phase 2."

   Proceed immediately — do not wait for confirmation.

### 4. Create Progress Document (if needed)

When the conversation is getting long or the plan has many phases, create:
`thoughts/progress/YYYY-MM-DD-HHmm-<plan-name>-progress.md`

```markdown
---
date: <ISO timestamp>
plan: "<original plan path>"
status: in_progress
completed_phases: [1, 2]
current_phase: 3
---

# Implementation Progress: <plan name>

**Completed Phases**: 1, 2
**Current Phase**: 3

## Completed Phases

### Phase 1: <name>
- All steps completed, tests passing

## Next Session Instructions

To continue:
1. Read this progress document
2. Read the original plan: `<plan path>`
3. Continue with Phase 3, Step 2
```

### 5. Final Completion

> "Implementation Complete!
>
> All phases executed:
> - Phase 1: <name>
> - Phase 2: <name>
>
> Testing:
> - Linting (npm run standard): PASSED
> - Test suite (npm test): PASSED
>
> Files modified:
> - `<file 1>`
> - `<file 2>`"

## Error Handling

### Test Failures — Auto-Recovery Loop

When tests fail, use the fix → validate agent loop to auto-recover (up to 3 attempts):

a. **Diagnose & propose fix** — spawn the **recovery-fix** agent with the test output and current phase
b. **Validate fix** — spawn the **recovery-validate** agent with the proposed fix and plan phase
c. **Apply or escalate**:
   - **Approve**: Apply the fix, re-run tests
   - **Approve with note**: Apply the fix, re-run tests, note the deviation
   - **Reject**: Escalate to human immediately

d. **Report each attempt**:
   > "**Auto-recovery attempt <N>/3:**
   >
   > Diagnosis: <root cause summary>
   > Fix: <what was changed>
   > Validation: <Approved / Approved with note>
   >
   > Re-running tests..."

**After 3 failed attempts or a rejected fix**, escalate to human:

> "Auto-recovery exhausted (or fix rejected).
>
> **Diagnosis**: <root cause>
> **Attempts**: <what was tried>
> **Issue**: <why auto-recovery couldn't resolve it>
>
> Options:
> 1. Revise the plan for this phase
> 2. Debug interactively
> 3. Stop and research the issue"

## Rules

### DO:
- Execute the plan AS WRITTEN
- Follow RED-GREEN-REFACTOR for EVERY phase — no exceptions
- Write tests BEFORE implementation code
- Verify new tests fail before writing implementation
- Test after EVERY phase

### DO NOT:
- Write implementation code before its tests
- Write tests that pass without implementation
- Skip the RED verification step
- Redesign during implementation
- Treat implementation as a design phase
