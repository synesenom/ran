---
date: 2026-07-16T06:24:50Z
category: "tooling"
problem: "Independent design-propose/critique/judge-panel agents each returned contradictory 'High confidence' recommendations for a trivial refactor"
status: complete
related_issue: "#950"
related_plan: "thoughts/plans/2026-07-15-2115-seed-reseed-duplication-rwm-hmc.md"
tags: [multi-agent, design-review, confidence-calibration, issue-scope-verification, adr, judge-panel]
---

# Solution: Design-panel "High confidence" votes don't correlate with verified premises

**Date**: 2026-07-16T06:24:50Z
**Category**: tooling
**Related Issue**: #950

## Problem

Issue #950 asked to deduplicate an identical `seed()` override (reseed a subclass-owned `Normal(0,1)` proposal generator, then recompute a cached log-density) copy-pasted across `RWM.seed()` and `HMC.seed()`. The issue's own Scope section explicitly deferred the extraction-mechanism choice ("a protected base-class method... or a standalone shared utility... should be made when this issue is picked up") between exactly two named options.

Resolving that one open decision required escalating through a design-propose agent, a design-critique agent, and — because they disagreed — a three-judge panel (simplicity/structure lens, convention lens, maintainability lens). The three judges split 1-1-1 across three *mutually exclusive* options (a new intermediate class, doing nothing, and a plain protected method), and **every one of the three votes was labeled "High confidence."** No amount of adding more independent agents converged on an answer; the orchestrating session had to manually adjudicate the tie by re-checking each vote's cited justification against the actual codebase.

## Root Cause

Two independent gaps compounded into this outcome:

1. **The issue's stated Scope was incomplete, and no agent caught this until the codebase was read directly.** `AdaptiveMetropolis.seed()` (a third file, not `rwm.js`/`hmc.js`) had the byte-for-byte identical pattern, but the issue never named it — whoever filed it apparently checked the two files they remembered rather than grepping the whole `src/mc/` directory. Had the fix been scoped to exactly the two named files, it would have shipped a third, now-inconsistent copy of the same logic on the same day the issue closed. This was only caught because the `/research` phase read every file in `src/mc/`, not just the ones the issue body listed.

2. **A judge's self-reported "High confidence" reflects internal argument coherence, not verified correctness of its premises.** The "do-nothing" judge (convention lens) cited ADR-0022's real rule — "extract shared logic only once a second sampler family demonstrates the pattern" — as grounds for High confidence that no refactor was warranted. But the rule's precondition (has a second family actually demonstrated the pattern?) was never checked against the codebase: the pattern had already occurred **three times** (RWM, AdaptiveMetropolis, HMC), which is the literal reason the issue existed. The judge quoted a real ADR correctly and still reached a false conclusion, because it treated the citation itself as sufficient evidence rather than checking the citation's premise. Symmetrically, the "intermediate class" judge (simplicity lens) was confidently wrong for the opposite reason: it treated "eliminates the most lines of duplication" as the deciding criterion without checking that the proposed mechanism fell entirely outside the two options the issue itself had scoped, and without accounting for `HMC`'s extra `gradLogDensity` constructor argument breaking the shared-constructor claim its own proposal depended on.

## Fix

- Migrated all three affected subclasses (`RWM`, `AdaptiveMetropolis`, `HMC`) — not just the two the issue named — after research surfaced the third occurrence by reading the source directly instead of trusting the issue body's file list.
- Added a plain protected instance method `_reseedCachedLogDensity(value)` to `MCMC` (`src/mc/_mcmc.js`), explicitly called (never auto-invoked) from each subclass's own `seed()` override — matching one of the two mechanisms the issue itself had named, and the issue's own suggested method name.
- Broke the 1-1-1 judge tie by re-verifying each vote's cited premise against the actual codebase/ADR text rather than by counting votes or trusting the self-reported confidence labels: counting how many times the ADR-0022 "second family" threshold had actually been crossed (three, not zero) discredited the "do-nothing" vote; checking the issue's literal Scope wording discredited the "intermediate class" vote. The surviving "plain protected method" vote was the only one whose cited premises held up under direct verification.
- Documented the decision, and the two rejected alternatives with their specific flaws, in `decisions/0027-mcmc-reseed-cached-log-density-hook.md`.

## Prevention Strategy

- **Treat an issue's "Scope" section as a hypothesis, not a complete file list.** Before finalizing a fix's scope, grep/read the whole relevant module directory — not just the files the issue names — for the same pattern. A research phase that only reads the files an issue lists inherits any gaps in the issue author's own memory.
- **When independent design agents (propose/critique/judge panels) disagree, do not resolve by vote count or by comparing self-reported confidence labels across agents.** Confidence labels are not calibrated against each other — three independent "High confidence" votes for three mutually exclusive answers is possible and, per this session, actually happened. Treat disagreement as a signal to re-verify, not to average or plurality-vote.
- **Resolve ties by checking each vote's factual premise against the artifact it cites, not by re-reading the vote's prose for persuasiveness.** A citation of a real, correctly-quoted ADR or convention can still support a false conclusion if the citation's precondition was never checked. When a vote leans on "rule X says Y," verify Y's precondition against the current codebase state before accepting the vote.
- **A proposed design option that falls outside an issue's explicitly named candidate mechanisms should be treated as scope creep by default**, not as equally admissible alongside the options the issue actually scoped — especially for `trivial`/`low`-priority issues where a heavier mechanism (new class, new file, new ADR-worthy hierarchy change) is disproportionate on its face.

## Related Solutions

- `solutions/tooling/2026-07-07-1601-agent-output-contract-caller-sync.md` — a different class of multi-agent reliability issue (output-format drift between agent versions and their callers), but shares the theme that agent-pipeline output must be independently verified rather than trusted at face value.

## Key Insight

When a design-propose/critique/judge-panel pipeline returns contradictory "High confidence" votes, resolve the tie by re-verifying each vote's factual premise against the codebase — not by counting votes or trusting self-reported confidence — because a judge's confidence measures how coherent its own argument feels to it, not whether the argument's premise is actually true.
