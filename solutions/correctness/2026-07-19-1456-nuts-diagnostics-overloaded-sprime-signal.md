---
date: 2026-07-19T14:56:05Z
category: "correctness"
problem: "Deriving a NUTS divergence diagnostic from the tree-level sPrime signal conflates energy divergences with ordinary U-turns"
status: complete
related_issue: "#1037"
related_plan: "thoughts/plans/2026-07-19-1322-nuts-sampler-health-diagnostics.md"
tags: [nuts, mcmc, diagnostics, divergence, u-turn, overloaded-signal, tree-recursion, sampler-health]
---

# Solution: Surfacing NUTS divergence without conflating it with U-turns

**Date**: 2026-07-19T14:56:05Z
**Category**: correctness
**Related Issue**: #1037

## Problem

`ran.mc.NUTS` mechanically computes two pathological run conditions — divergent
transitions (leapfrog Hamiltonian drift beyond `DELTA_MAX = 1000` nats) and max-tree-depth
saturation — but exposed neither. Stan/PyMC/NumPyro users expect per-iteration
`divergent`/`treedepth==max` diagnostics; ranjs's NUTS had no way to distinguish a healthy
run from a silently biased one. The task was to surface these, and the trap was in *how*.

## Root Cause

Not a bug in shipped code — a **design trap** that had to be solved before writing the
implementation. The doubling-tree's `sPrime` signal is **overloaded across recursion
levels**:

- At a **leaf** (`_buildTreeLeaf`, depth 0), `sPrime === 0` means exactly one thing: the
  energy-divergence guard tripped (`ctx.logU < DELTA_MAX + h` is false). There is no U-turn
  check at a single point.
- At every **non-leaf** node, `_combineSubtrees` computes
  `sPrime: second.sPrime * NUTS._noUTurn(...)`, multiplying in the U-turn indicator. So
  above the leaf, `sPrime === 0` can mean *either* "a leaf diverged" *or* "the trajectory
  U-turned."

Naively deriving a `divergent` diagnostic from `sPrime === 0` anywhere above the leaf would
count every ordinary, healthy U-turn as a divergence — inflating `divergenceCount()` on
every well-behaved run, exactly inverting the diagnostic's meaning.

## Fix

Originate a dedicated `divergent` boolean **only at `_buildTreeLeaf`**, where `sPrime === 0`
is provably exclusive to the energy guard (`divergent = !withinEnergyBound`). Propagate it
upward by **OR-merging** in `_combineSubtrees` (`first.divergent || second.divergent`),
`_buildTreeBranch` (short-circuit `return first` carries its flag), and `_growTree`
(`divergent = divergent || subtree.divergent`) — **never** routing it through `_noUTurn`
and **never** re-deriving it from `sPrime` at a branch.

`maxDepthHit` needed its own care: `j === MAX_TREE_DEPTH && s === 1`. The `s === 1` conjunct
excludes the case where a U-turn stops the loop exactly on the last allowed doubling — that
is a *satisfied* trajectory, not an artificially capped one.

The two counters ride the existing ADR-0023 accumulator-reset lifecycle via a first-of-its-
kind `_initAccumulators()` override (calls `super`, then zeroes the counters), so they reset
at construction and `sample()` start exactly like `ar()`. A regression test asserting
"well-behaved standard-Normal target → many U-turns but `divergenceCount() === 0`" guards
the conflation trap specifically (a benign run produces many U-turns; if any leaked into the
divergence count, the test fails).

## Prevention Strategy

When a flag is computed by **combining two independent stopping conditions into one shared
signal** (here, `sPrime = energyGuard × uTurnCheck`), any diagnostic that must distinguish
*which* condition fired has to:

1. **Originate at the unique point where the signal is unambiguous** — the leaf, where only
   one condition exists.
2. **Thread through the combination logic in its own field**, OR-merged, never re-derived
   from the combined signal at an intermediate node.

Before threading a new per-transition diagnostic through a recursive tree/loop, explicitly
ask: *"Does this signal mean the same thing at every level of the recursion, or does an
intermediate combinator overload it?"* If overloaded, split the diagnostic out at the base
case.

## Related Solutions

- `solutions/correctness/2026-07-19-1250-nuts-uturn-velocity-not-momentum.md` — another
  subtle NUTS U-turn invariant (the criterion must use velocity `M⁻¹r`, not raw momentum);
  reinforces that the tree's stopping logic is easy to get plausibly-but-silently wrong.

## Key Insight

In NUTS's doubling tree, `sPrime === 0` means "energy divergence" only at the leaf and
"divergence OR U-turn" everywhere else — a diagnostic that needs to distinguish the two must
originate at the leaf and be OR-propagated in its own field, never re-derived from `sPrime`
at a branch.
