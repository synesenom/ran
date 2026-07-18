---
date: 2026-07-18T16:57:53Z
category: "algorithm"
problem: "Whether HMC's stepSize-only periodicity jitter needed to extend to pathLength to fix resonance-driven negative lag-1 autocorrelation"
status: complete
related_issue: "#1005"
related_plan: "thoughts/plans/2026-07-18-1636-hmc-pathlength-resonance-jsdoc.md"
tags: [mcmc, hmc, resonance, periodicity, jitter, design-escalation, nuts]
---

# Solution: HMC pathLength jitter — a narrow jitter range can look like a fix while changing nothing

**Date**: 2026-07-18T16:57:53Z
**Category**: algorithm
**Related Issue**: #1005

## Problem

`ran.mc.HMC` jitters `stepSize` by ±10% every iteration (`JITTER_LO=0.9`/`JITTER_RANGE=0.2` in
`src/mc/hmc.js`) specifically to avoid resonance artifacts on periodic trajectories, but
`pathLength` (leapfrog steps per iteration) is fixed for the sampler's entire lifetime. Issue
#1005 asked whether this asymmetry was a real gap needing a code fix (extend jitter to
`pathLength` too) or whether the existing stepSize-only jitter was already sufficient, given
users could observe genuine negative lag-1 autocorrelation — and `ess()` saturating to exactly
the sample size — at certain target correlations (previously confirmed non-buggy in #974).

## Root Cause

An empirical sweep of a bivariate correlated-Normal target across both `rho` and `pathLength`
(run against the live, unmodified `HMC` implementation, with `stepSize` jitter active throughout
— it always is in production) showed resonance bands in lag-1 autocorrelation as narrow as 2-3
integer `pathLength` values: at fixed rho=0.9, pathLength=8 → ac≈-0.35, pathLength=10 → ac≈-0.07,
pathLength=12 → ac≈+0.41, pathLength=15 → ac≈+0.90.

The "obvious" fix — reusing the existing ±10% jitter constants for `pathLength` too — was checked
against this data before being written as code, and found ineffective: for the default
`pathLength=10`, ±10% jitter rounds to only `{9, 10, 11}`, all three of which sit inside the
*same* negative-autocorrelation band the sweep measured. Jittering one factor of the
trajectory-length product (`pathLength * stepSize`) does not reliably escape resonance driven by
the other factor unless the jitter range is wide enough to actually cross a band boundary — a
property that must be checked against the measured resonance-band width, not assumed from the
jitter's existing (unrelated) convention.

## Fix

No algorithmic change. Two design subagents evaluated the same evidence and disagreed:
design-propose favored implementing a new, wider (±20%, dedicated constants) `pathLength` jitter
plus the JSDoc update, but flagged LOW confidence. design-critique, given the same sweep data,
argued JSDoc-only with HIGH confidence — proving with the sweep's own numbers that the naive
±10%-reuse fix would add complexity and cost seeded-PRNG reproducibility (an extra
`this.r.next()` draw per iteration shifts the accept/reject draw's position in the sequence)
while fixing nothing for the default configuration, and that even a wider empirically-tuned
range has no theoretical guarantee of generalizing beyond the one target family it was measured
on — whereas `NUTS` already exists in this codebase as the principled, general fix (adaptive
trajectory length by construction).

Because the two agents disagreed, the orchestrator escalated to the user via `AskUserQuestion`
rather than auto-resolving (per the `/plan` skill's synthesis rule: disagreement always
escalates, regardless of either side's individual confidence). The user chose the doc-only path.
`src/mc/hmc.js`'s class-level JSDoc now explicitly documents the "Known limitation," names it as
a legitimate property of `ess()`/`ac()` (not an estimator bug, cross-referencing #974), and
points affected users at `ran.mc.NUTS`.

## Prevention Strategy

When a "just widen the jitter" fix is proposed for a resonance/periodicity problem, measure the
resonance band width against the proposed jitter range using whatever diagnostic already exists
(here, `ac()`'s own lag-1 output swept across the suspect parameter) *before* writing the fix. A
jitter that stays inside one resonance band changes nothing but adds complexity and can silently
break other invariants (here, seeded-PRNG reproducibility) — and it is easy to assume a jitter
"obviously" helps without checking the actual band geometry it needs to cross.

Separately: when two independent design reviews (propose/critique) reach opposite conclusions on
the same evidence — even if one side reports HIGH confidence — that is a signal to escalate to a
human decision, not to silently prefer the higher-confidence or more code-producing option. See
`solutions/tooling/2026-07-16-0624-design-panel-confidence-vs-verified-premises.md` for a related
case where a reviewer panel's stated confidence didn't track the strength of its actual evidence.

## Related Solutions

- `solutions/tooling/2026-07-16-0624-design-panel-confidence-vs-verified-premises.md` — same
  class of lesson (design-panel confidence is not a substitute for verifying the panel's
  premises against evidence), from an unrelated `seed()` deduplication decision.
- `solutions/correctness/2026-07-18-1526-hmc-max-path-length-sibling-bound-risk-class-mismatch.md`
  — a prior HMC `pathLength`-adjacent finding: `_MAX_PATH_LENGTH` was borrowed from a sibling
  sampler's bound without independently checking it fit HMC's own risk class. Same general
  pattern as this issue: a parameter borrowed/reused from an existing convention (there, a
  numeric bound; here, a jitter range) needs its own justification, not just precedent.

## Key Insight

A parameter jitter only mitigates resonance if its range is wide enough to cross a measured
resonance-band boundary — verify this against the diagnostic's own swept data before
implementing the jitter, because a narrow jitter (e.g. ±10% rounding to the same 3 integers) can
look like a principled fix while changing nothing and quietly breaking PRNG-sequence
reproducibility.
