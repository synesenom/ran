---
date: 2026-07-31T08:50:00Z
category: "distribution"
problem: "RandomWalk.marginal(t) needed an affine-transformed Binomial with no public-distribution equivalent, and the private-class exemption it was given conflicted with CLAUDE.md's literal _fitInit rule"
status: complete
related_issue: "#1156"
related_plan: "thoughts/plans/2026-07-31-0734-issue-1156-marginal-poisson-ar1-randomwalk.md"
tags: [distribution, private-class, adr, fitInit, code-review, affine-transform, marginal]
---

# Solution: Private ShiftedBinomial distribution for RandomWalk.marginal(t), and reconciling its ADR exemption with CLAUDE.md's _fitInit rule

**Date**: 2026-07-31T08:50:00Z
**Category**: distribution
**Related Issue**: #1156

## Problem

`RandomWalk.marginal(t)` needed to return a `Distribution` instance for `X_t = 2K - t`, `K ~ Binomial(t, p)` — an affine (shift/scale) transform of an existing distribution's support. No class in `src/dist/` had ever wrapped another distribution's support with an affine transform, so there was no precedent for the math (remapping support/parity in `_pdf`/`_cdf`), and no precedent for the process question it immediately raised: does a helper class only one caller (`RandomWalk.marginal()`) will ever construct need to go through the *entire* "Adding a New Distribution" checklist (mpmath precision gate, `dist-cases` entry, subpath export, README/CHANGELOG, and a mandatory `static _fitInit`), or can it be a lighter-weight private implementation detail?

## Root Cause

Two related gaps. First, no existing `Distribution` subclass modeled "pushforward of another distribution under an affine map on its support," so the parity-gap `_pdf`/`_cdf` logic (`x` and `n` must share parity; `k = (n+x)/2`) had to be derived from scratch, mirroring the pattern already used ad hoc inside `RandomWalk.pdf(x,t)` itself.

Second, CLAUDE.md's "Adding a New Distribution" checklist states `_fitInit` is "**Always — never omit**" for "every subclass of `Distribution`," with no textual carve-out for private/non-exported classes. The new ADR-0045 asserted an exemption from `_fitInit` for exactly this situation — reasoning from the issue's own acceptance criteria (which lists the API surface `marginal()` must expose, and pointedly excludes `fit()`) rather than from the checklist's literal words. The ADR and the style guide were making two different claims that looked compatible in spirit but conflicted in text — and a review pass (review-conventions agent, quoting the exact "Always — never omit" line) caught the conflict before commit.

## Fix

- Represented the affine-transformed `Binomial` as `ShiftedBinomial`, a **private, non-exported** `Distribution` subclass (`src/dist/_shifted-binomial.js`), following existing precedent for single-consumer private dist files (`_sign.js`, used only by `student-t.js`). It computes `_pdf`/`_cdf` directly via `logBinomial`/`regularizedBetaIncomplete` (the same special functions `Binomial` uses) rather than delegating to an internal `Binomial` instance — `Binomial` has no `_q`, so delegation would only add indirection with no benefit.
- Codified the public-vs-private decision as [ADR-0045](../../decisions/0045-private-distribution-subclass-for-process-marginals.md): a process's marginal may return a private `Distribution` subclass, skipping `dist-cases`/precision-gate/subpath-export/README/CHANGELOG paperwork, when (a) no natural public name for the distribution exists in the literature, and (b) the consuming contract (`Process.marginal()`'s promised API) doesn't require the omitted parts.
- Resolved the `_fitInit` conflict conservatively rather than editing the ADR (ADRs are immutable once Accepted): since ADR-0045's language was "exempt" (optional) rather than "must omit" (forbidden), `_fitInit` was implemented anyway — a small method-of-moments estimator — plus a direct test (`ShiftedBinomial.fit()` on sampled data) purely to satisfy the 100%-function-coverage gate. The stricter, more explicit rule (CLAUDE.md's literal text) was treated as binding over the newer, softer one (the ADR) wherever the two could be read as in tension.

## Prevention Strategy

When an ADR carves out an exemption from an existing, more general project rule — especially one phrased as absolutely as "Always — never omit" — the ADR must either (a) explicitly amend or add a documented exception to the general rule's text at its source (here, the "Adding a New Distribution" checklist table in CLAUDE.md), or (b) use unambiguous "may omit"/"optional" language and explain why the stricter rule's rationale doesn't apply, rather than asserting an exemption a literal reading of the source rule doesn't support.

Generalizable check: whenever an ADR grants an exemption from a documented CLAUDE.md rule, explicitly diff the ADR's claim against the rule's literal wording during review — not just against the rule's presumed intent. A review pass that greps the exact rule text ("Always — never omit", "every subclass") against the new file is what caught this here.

## Related Solutions

None found at the time of writing — this is the first documented case of a private `Distribution` subclass exemption conflicting with the "Adding a New Distribution" checklist.

## Key Insight

When deciding whether a single-consumer helper class needs the full "new distribution" checklist, the deciding question is not "is this class exported publicly" but "does the contract the caller actually promises require the parts the checklist exists to guarantee" — but any such exemption must be reconciled against the *literal text* of blanket rules like CLAUDE.md's "_fitInit always, never omit," not just their presumed spirit, because "exempt" and "forbidden to omit" can both sound reasonable for the same sentence until you check which one was actually written down.
