---
date: 2026-07-15T10:43:36Z
category: "algorithm"
problem: "ARS's non-log-concavity guard missed a bimodal (clearly non-log-concave) target because tangent-slope monotonicity alone is not sufficient to detect an invalid hull"
status: complete
related_issue: "#820"
related_plan: "thoughts/plans/2026-07-15-0718-adaptive-rejection-sampling.md"
tags: [adaptive-rejection-sampling, gilks-wild, tangent-hull, log-concavity, envelope-validity, mc]
---

# Solution: Tangent-hull validity needs a breakpoint-bracket check, not just slope monotonicity

**Date**: 2026-07-15T10:43:36Z
**Category**: algorithm
**Related Issue**: #820

## Problem

`ran.mc.ARS` (Gilks-Wild 1992 Adaptive Rejection Sampling) must throw `Error` when the caller's target density is not actually log-concave, since a tangent-line upper hull is only a valid upper bound when the target is concave — sampling from an invalid hull would silently produce wrong draws instead of failing loudly.

The initial implementation (matching the plan) detected this with a single check: tangent slopes (`dh`) must be non-increasing across the sorted abscissae. Against the acceptance-criteria test case — a bimodal Gaussian mixture with modes at ±3 — this check did not fire. The first three bootstrap abscissae (quartile points of the support, landing at x = -4, 0, 4) produced tangent slopes of exactly `(1, 0, -1)`, a perfectly monotonic sequence, even though the target is obviously not log-concave.

## Root Cause

Slope monotonicity is a *necessary* condition for a valid concave-function tangent hull, but not a *sufficient* one. A sparse sample of only 3 abscissae can land at points where the tangent slopes still happen to decrease monotonically even though the density is not concave between them — the violation hides in the region between sampled points, not at the points themselves.

The stronger, sufficient signature is geometric rather than purely slope-based: for a genuinely concave function, any two adjacent tangent lines must intersect *strictly inside* the interval bracketed by their two abscissae (this is exactly why the tangent-hull construction works at all — the intersection point becomes the breakpoint between the two hull segments). For the bimodal case, hand-computing the breakpoints showed they land at z ≈ ±7.3 — far outside their `(-4, 0)` and `(0, 4)` brackets. That is unambiguous evidence the "hull" being constructed does not actually bound the density from above.

This was found empirically: the first red/green pass built the non-log-concavity test around the plan's originally-specified slope-only check, ran it, and it *passed* (i.e. no error was thrown) against the adversarial bimodal case that the acceptance criteria explicitly require to throw. Investigating why led to hand-computing the breakpoint formula in a scratch node script, which revealed the out-of-bracket intersection.

## Fix

Added `_assertValidHullSegment(pi, pj, z)` in `src/mc/ars.js`, checking both conditions together:
1. `pi.dh >= pj.dh` (slope non-increasing, tolerance-guarded by `Math.cbrt(EPS)`-scaled tolerance, matching the finite-difference noise floor).
2. The already-computed tangent intersection `z` (the breakpoint) falls within `[pi.x, pj.x]` (same tolerance).

Either violation throws `Error('ARS: density is not log-concave')`. Since `_build()` already computes `z` to construct the hull, the second check is essentially free — it only needed to be *checked*, not separately computed.

## Prevention Strategy

When implementing any rejection-sampling or envelope-based algorithm whose correctness depends on a geometric invariant (here: "tangent lines actually bound the function from above"), enumerate every necessary condition that invariant implies before picking just one as the runtime guard. A single per-point derived statistic (like slope) looking locally consistent does not rule out a global violation — also verify that any derived *geometric construct* (an intersection point, a breakpoint, a bracket) stays within the range that the assumed concavity/convexity actually guarantees.

Concretely: when a red test built around the plan's originally-specified check does not fail against the adversarial case named in the acceptance criteria, treat that as a signal the check itself is insufficient — strengthen the check, don't weaken or skip the test.

## Related Solutions

- None found for tangent-hull/envelope validity specifically; `solutions/algorithm/2026-06-01-0210-chandrupatla-bracket-guard-and-brent-defects.md` documents a related but distinct lesson (bracket-guard ordering in a root-finder), not directly reused here since ARS's tangent intersection is closed-form, not a root-find.

## Key Insight

For any tangent-line/secant-line upper-hull construction, slope monotonicity alone is not sufficient to detect non-concavity — always also verify that each pair of adjacent tangent lines' computed intersection point falls strictly within the bracketing interval of their two abscissae.
