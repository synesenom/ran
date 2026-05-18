# Claude Code Configuration

This directory contains the skills and agents that power the development workflow.

## Overview

```
.claude/
├── skills/         # User-invocable skills (slash commands)
│   ├── build/SKILL.md        # Orchestrator: full pipeline
│   ├── next/SKILL.md         # Leaf: pick next issue from backlog
│   ├── suggest/SKILL.md      # Leaf: suggest and create future issues
│   ├── push/SKILL.md         # Leaf: push to remote
│   ├── research/SKILL.md     # Leaf: codebase research
│   ├── explore/SKILL.md      # Leaf: free-form exploration notebook
│   ├── plan/SKILL.md         # Leaf: implementation planning
│   ├── implement/SKILL.md    # Leaf: plan execution (TDD)
│   ├── fix/SKILL.md          # Leaf: fix straightforward issue (no research/plan)
│   ├── hotfix/SKILL.md       # Leaf: small targeted fix (no research/plan)
│   ├── commit/SKILL.md       # Leaf: git commit
│   ├── review/SKILL.md       # Leaf: code review
│   ├── pull-request/SKILL.md # Leaf: GitHub PR creation
│   ├── validate/SKILL.md     # Leaf: verify issue acceptance criteria
│   └── compound/SKILL.md     # Leaf: document solved problems
└── agents/         # Specialized subagents (not user-invocable)
    ├── discovery-thoughts.md  # Finds research/plans/solutions
    ├── discovery-code.md      # Finds relevant code files
    ├── discovery-analyze.md   # Analyzes how code works
    ├── design-propose.md      # Generates concrete design options
    ├── design-critique.md     # Evaluates design options against conventions
    ├── recovery-fix.md        # Diagnoses test failures and proposes fix
    ├── recovery-validate.md   # Checks fixes don't deviate from plan
    ├── review-correctness.md  # Reviews for mathematical/statistical bugs
    ├── review-docs.md         # Reviews for documentation gaps
    ├── review-performance.md  # Reviews for performance issues
    ├── review-security.md     # Reviews for security issues
    ├── review-simplicity.md   # Reviews for over-engineering
    ├── review-tests.md        # Reviews for test quality gaps
    ├── ops-insight.md         # Extracts problem/fix/insight from diffs
    ├── ops-issue.md           # Creates GitHub issues
    ├── ops-triage.md          # Classifies surfaced-bug observations into definite/ambiguous/not-a-bug
    ├── suggest-distributions.md  # Suggests new probability distributions
    ├── suggest-methods.md        # Suggests new statistical methods/metrics
    ├── suggest-testing.md        # Suggests test coverage improvements
    ├── suggest-infra.md          # Suggests infrastructure improvements
    ├── suggest-wildcard.md       # Unconstrained brainstorming
    └── suggest-rank.md           # Deduplicates and ranks suggestions
```

## Skills

### Orchestrators

Full pipelines that chain multiple skills together.

| Skill | Pipeline | When to use |
|-------|----------|-------------|
| [`/build`](skills/build/SKILL.md) | research → plan → implement → validate → review → ship (commit, compound, push, PR) | Full pipeline from issue to PR |

### Leaf Skills

Standalone skills that do one thing. Can be called directly or composed by orchestrators.

| Skill | Purpose | Input |
|-------|---------|-------|
| [`/research`](skills/research/SKILL.md) | Document what exists in the codebase | Topic, `#issue`, or issue URL |
| [`/explore`](skills/explore/SKILL.md) | Free-form exploration of a statistical topic | `#issue` or topic string |
| [`/plan`](skills/plan/SKILL.md) | Create a phased implementation plan | Topic, `#issue`, or research file |
| [`/implement`](skills/implement/SKILL.md) | Execute a plan phase-by-phase (TDD) | Plan file, `#issue`, or description |
| [`/fix`](skills/fix/SKILL.md) | Fix straightforward issue, skip research/plan | `#issue` or issue URL |
| [`/hotfix`](skills/hotfix/SKILL.md) | Small targeted fix, skip research/plan | Description or `#issue` |
| [`/commit`](skills/commit/SKILL.md) | Stage and commit with generated message | _(no args)_ |
| [`/push`](skills/push/SKILL.md) | Push commits to remote | _(no args)_ |
| [`/review`](skills/review/SKILL.md) | Code review against plan + quality checks | _(no args, reviews current branch)_ |
| [`/pull-request`](skills/pull-request/SKILL.md) | Create a PR with change categorization | _(no args)_ |
| [`/validate`](skills/validate/SKILL.md) | Verify issue acceptance criteria are met | `#issue` or issue URL |
| [`/next`](skills/next/SKILL.md) | Pick the best next issue from the backlog | Milestone _(optional)_ |
| [`/suggest`](skills/suggest/SKILL.md) | Suggest and create future issues from codebase analysis | _(no args)_ |
| [`/compound`](skills/compound/SKILL.md) | Document a solved problem for future learning | Description _(optional)_ |

## Typical Workflows

### Suggest, next, and solve

```
/suggest                # Scan codebase, suggest and create new issues
/next                   # Score and rank open issues, pick the best one
/build #111             # Build the picked issue
```

### Full pipeline

```
/build #111
```

```
research → plan → implement → validate → review → ship
    │         │        │           │         │         │
    ▼         ▼        ▼           ▼         ▼         ▼
 Understand  Design   TDD       Check     6 review   Commit, compound,
 codebase    options  phase by  issue     agents in  push, create PR
 context     auto-    phase     criteria  parallel,  (compound before
             resolved           (loop)    auto-fix   push avoids 2x CI)
```

### Manual step-by-step

```
/research #111          # Understand the codebase
/plan #111              # Create implementation plan
/implement #111         # Execute the plan (TDD)
/validate #111          # Verify all acceptance criteria met
/commit                 # Commit changes
/review                 # Review before pushing
/compound               # Document what was learned
/push                   # Push to remote (includes compound commit)
/pull-request           # Create the PR
```

### Exploration (no plan needed)

```
/explore #111           # Research + exploration notes in one step
```

## Agents

Agents are specialized subagents spawned by skills. They run in parallel where possible and are not directly invocable by the user.

### `discovery-*` — Find and understand code and documents

| Agent | Model | Used by | Purpose |
|-------|-------|---------|---------|
| [`discovery-thoughts`](agents/discovery-thoughts.md) | Haiku | review, plan, implement, compound | Find research, plans, solutions in `thoughts/` |
| [`discovery-code`](agents/discovery-code.md) | Haiku | research, plan | Find relevant code files by pattern/keyword |
| [`discovery-analyze`](agents/discovery-analyze.md) | Sonnet | research, plan | Trace data flows and document how code works |

### `design-*` — Auto-resolve design decisions

Launched by [`/plan`](skills/plan/SKILL.md). High-confidence decisions are auto-selected; low-confidence ones escalate to the human.

| Agent | Model | Used by | Purpose |
|-------|-------|---------|---------|
| [`design-propose`](agents/design-propose.md) | Sonnet | plan | Generate 2-3 concrete design options with file-level sketches |
| [`design-critique`](agents/design-critique.md) | Sonnet | plan | Evaluate options against conventions, testing burden, complexity |

### `recovery-*` — Auto-recover from test failures

Launched by [`/implement`](skills/implement/SKILL.md) when tests fail. Auto-recovers up to 3 attempts before escalating to the human.

| Agent | Model | Used by | Purpose |
|-------|-------|---------|---------|
| [`recovery-fix`](agents/recovery-fix.md) | Sonnet | implement | Diagnose test failure and propose minimal fix |
| [`recovery-validate`](agents/recovery-validate.md) | Sonnet | implement | Check fix doesn't deviate from plan intent |

### `review-*` — Parallel quality checks

All launched **in parallel** by [`/review`](skills/review/SKILL.md). Each returns findings rated P1/P2/P3.

| Agent | Model | Focus |
|-------|-------|-------|
| [`review-security`](agents/review-security.md) | Haiku | Injection risks, unsafe eval, path traversal |
| [`review-performance`](agents/review-performance.md) | Haiku | Unnecessary allocations, O(n²) patterns, hot-path issues |
| [`review-simplicity`](agents/review-simplicity.md) | Haiku | Over-engineering, dead weight, convention violations |
| [`review-tests`](agents/review-tests.md) | Sonnet | Test quality: behavior-first, edge cases, statistical rigor |
| [`review-docs`](agents/review-docs.md) | Haiku | Missing/stale JSDoc, README, ADRs |
| [`review-correctness`](agents/review-correctness.md) | Sonnet | Mathematical/statistical bugs: wrong formulas, numerical issues, off-by-one |

### `suggest-*` — Codebase improvement scouts

Launched **in parallel** by [`/suggest`](skills/suggest/SKILL.md). Each scout scans a domain. The ranker deduplicates against existing issues and produces a scored list.

| Agent | Model | Domain |
|-------|-------|--------|
| [`suggest-distributions`](agents/suggest-distributions.md) | Sonnet | New probability distributions to implement |
| [`suggest-methods`](agents/suggest-methods.md) | Sonnet | New statistical methods, tests, and metrics |
| [`suggest-testing`](agents/suggest-testing.md) | Sonnet | Test scenarios, edge cases, statistical correctness gaps |
| [`suggest-infra`](agents/suggest-infra.md) | Sonnet | Build, tooling, docs pipeline, utility gaps |
| [`suggest-wildcard`](agents/suggest-wildcard.md) | Sonnet | Unconstrained brainstorming across all dimensions |
| [`suggest-rank`](agents/suggest-rank.md) | Sonnet | Dedup against open issues, score and rank |

### `ops-*` — Capture outcomes

| Agent | Model | Used by | Purpose |
|-------|-------|---------|---------|
| [`ops-insight`](agents/ops-insight.md) | Sonnet | compound | Extract problem/root-cause/fix/prevention from diffs and plans |
| [`ops-issue`](agents/ops-issue.md) | Haiku | (manual, ops-triage) | Create GitHub issues with priority + difficulty labels |
| [`ops-triage`](agents/ops-triage.md) | Sonnet | fix, hotfix, build | Classify surfaced-bug observations into definite/ambiguous/not-a-bug; draft `ops-issue` input for definite bugs |

## Command → Agent Dependency Map

```
/research ────→ discovery-code
              → discovery-analyze

/plan ────────→ discovery-thoughts
              → discovery-code
              → discovery-analyze
              → design-propose   ┐ design decision
              → design-critique  ┘ auto-resolution
              → writes ADRs to decisions/

/implement ──→ discovery-thoughts
              → recovery-fix       ┐ auto-recovery
              → recovery-validate  ┘ loop (up to 3x)

/review ─────→ discovery-thoughts
              → review-security    ┐
              → review-performance │
              → review-simplicity  │ parallel
              → review-tests       │
              → review-docs        │
              → review-correctness ┘

/compound ───→ discovery-thoughts
              → ops-insight

/push ───────→ (no agents, just git push)

/pull-request → (no agents, ADR gate for non-trivial PRs)

/build ──────→ research → plan → implement → validate → triage → review → ship(commit, compound, push, PR)
               Uses all agents: discovery-*, design-*, recovery-*, ops-triage, review-*, ops-*

/validate ───→ discovery-thoughts

/fix ────────→ ops-triage
              → ops-issue (per definite bug)
              → review-* (conditional, only when .js files changed)
/hotfix ─────→ ops-triage
              → ops-issue (per definite bug)
              → review-correctness (lightweight check before commit)
/commit ─────→ (no agents)
/explore ────→ (no agents, uses web search + codebase reads)
/next ───────→ (no agents, fetches GitHub issues via gh CLI)

/suggest ───→ suggest-distributions ┐
              → suggest-methods      │
              → suggest-testing      │ parallel scouts
              → suggest-infra        │
              → suggest-wildcard     ┘
              → suggest-rank           (sequential, after scouts)
              → ops-issue              (parallel, for each selected suggestion)
```

## Design Principles

1. **Two layers**: One orchestrator (`/build`) composes leaf skills via the Skill tool. Leaf skills do one thing.
2. **Every skill is standalone**: All leaf skills work independently and handle their own autonomy. The orchestrator invokes them sequentially.
3. **Review is the orchestrator's responsibility**: `/build` runs `/review` before shipping. Leaf skills don't enforce review.
4. **Agents are invisible to the user**: Users invoke skills; skills spawn agents as needed.
5. **Haiku for focused tasks, Sonnet for deep analysis**: Locators and pattern-matching reviewers use Haiku. Code analysis and correctness review use Sonnet.
6. **Prefer direct Glob over `discovery-thoughts` for simple lookups**: When `thoughts/` is small and the search is straightforward, use `Glob("thoughts/**/*.md")` + `Read` directly. Reserve `discovery-thoughts` for fuzzy/semantic matching across many documents.
