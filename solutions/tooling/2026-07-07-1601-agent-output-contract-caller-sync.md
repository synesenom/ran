---
date: 2026-07-07T16:01:00Z
category: "tooling"
problem: "Agent output format change broke review-pr verdict logic silently"
status: complete
related_issue: "#862"
related_plan: "N/A"
tags: [review, agents, skill, output-contract, block-warn, P1-P2-P3, review-pr]
---

# Solution: Agent Output Contract Changes Must Sync All Callers Atomically

**Date**: 2026-07-07T16:01:00Z
**Category**: tooling
**Related Issue**: #862

## Problem

After review agents changed their output format from P1/P2/P3 severity ratings to a
Block/Warn format, the `review-pr/SKILL.md` skill still expected P1/P2/P3. The verdict
logic would have silently passed PRs that agents correctly flagged as "Block" — because
the orchestrating skill was looking for "P1" labels that no longer existed.

Additionally, the agent count changed from 6 to 8 (added `review-structure`,
`review-conventions`, `review-impact`; removed `review-simplicity`), and the skill's
parallel launch call still referenced the deleted `review-simplicity` agent.

## Root Cause

Agent output contracts are implicit — no schema is enforced between an agent and its
caller at the system level. When the `review/SKILL.md` agents were updated to use
Block/Warn format, the `review-pr/SKILL.md` caller was not audited for compatibility,
creating a silent format mismatch that would have produced wrong verdicts.

## Fix

Update `review-pr/SKILL.md` in the same change that modifies the agent set and format:
- Replace the 6-agent list with the 8-agent list (add the three new agents, remove
  `review-simplicity`)
- Replace all P1/P2/P3 terminology with Block/Warn throughout the verdict logic,
  request-changes template, and reporting section
- Update the agent count in the "Launch exactly N review agents" critical instruction

## Prevention Strategy

Treat an agent's output format as a versioned API. When modifying any agent called by
an orchestrating skill, grep `.claude/skills/` for every reference to that agent name
and audit each caller for format compatibility. Update all callers atomically in the
same commit as the agent format change. The fast audit command:

```bash
grep -r "review-" .claude/skills/ .claude/agents/ --include="*.md" -l
```

## Related Solutions

- `solutions/tooling/2026-05-24-1439-shared-stylesheet-cross-page-selector-leak.md` —
  a similar pattern where a shared resource (stylesheet) had callers that needed
  coordinated updates

## Key Insight

Agent output format changes are silent breaking changes — the orchestrating skill
silently misclassifies findings unless its verdict logic and output template are updated
atomically with the agent's format change.
