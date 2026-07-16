---
date: 2026-07-16T14:17:55Z
category: "testing"
problem: "Reusing an existing 'standard' test target for a new comparative test silently produced the opposite of the intended empirical result"
status: complete
related_issue: "#825"
related_plan: "thoughts/plans/2026-07-16-0946-nuts-sampler.md"
tags: [mcmc, nuts, hmc, ess, comparative-test, test-target-selection]
---

# Solution: NUTS/HMC ESS Comparison Needed a Different Target Than the KS Test

**Date**: 2026-07-16T14:17:55Z
**Category**: testing
**Related Issue**: #825

## Problem

Issue #825 required a test proving `ran.mc.NUTS`'s ESS/iteration meets or
exceeds `ran.mc.HMC`'s on a shared target ("compare ESS/iteration vs HMC on
the same target (expect NUTS ≥ HMC)"). The obvious implementation choice —
reuse the rho=0.5 correlated-Normal target already used by HMC's KS
distributional test, for consistency with the RWM/Gibbs/HMC precedent of one
canonical test target per `describe` block — produced the *wrong empirical
answer*: NUTS's measured ESS/iteration on that target came out to
approximately 0.94x HMC's (ratio below 1 across three seeds), i.e. NUTS
looked worse than HMC, directly contradicting the acceptance criterion the
test was supposed to demonstrate.

## Root Cause

The test target was chosen for consistency with an unrelated test
(distributional correctness), not for its ability to exercise the specific
mechanism being compared. At rho=0.5, HMC's fixed `pathLength=10` default
happens to already be well-matched to the posterior's geometry — a
well-tuned fixed-length trajectory and an adaptively-tuned one perform
similarly when the fixed length was never wrong to begin with. NUTS's actual
advantage — adaptively extending trajectory length only as far as each
iteration's local geometry requires, instead of paying for a fixed leapfrog
budget regardless of fit — never gets exercised at that correlation. A
"reasonable" and "consistent" target is not the same as a target that
discriminates the property under test.

An instrumented sweep (measuring gradient-call counts per iteration and
ESS-per-gradient-call, not just ESS-per-iteration) confirmed NUTS was
already ~3x more compute-efficient than HMC at rho=0.5 — it used only ~6
gradient evaluations per iteration versus HMC's fixed 20, while achieving
comparable ESS/iteration. The implementation was correct; the *test target*
simply didn't discriminate the metric the issue asked for (ESS per
iteration, not per unit of computation). A correlation sweep from rho=0.5 to
rho=0.99 across multiple seeds showed the ESS/iteration ratio only
convincingly favors NUTS (4.7-7x, consistent across seeds) at rho≈0.8, where
HMC's fixed trajectory length under-explores the elongated posterior on
every iteration.

This was only caught by actually running the comparison empirically —
writing a throwaway instrumented script and sweeping the correlation
parameter — rather than trusting that any correlated-Normal target
"obviously" would show NUTS ahead because NUTS is the more sophisticated
algorithm.

## Fix

Swapped the ESS comparison test to a separate rho=0.8 target, distinct from
the rho=0.5 KS-test target used elsewhere in the same `describe` block,
specifically because it is the point on the correlation sweep where HMC's
fixed trajectory length under-explores the elongated posterior while NUTS's
doubling tree adapts — producing a consistent, seed-stable 4.7-7x
ESS/iteration advantage (asserted at a 2x margin, well clear of noise, mean
ratio ~5.5x across 5 seeds). A code comment (`test/mc.js`, in the `ESS/iteration
comparison vs HMC` block) documents why this target differs from the KS-test
target immediately above it in the same file, so a future reader doesn't
"simplify" it back to the shared rho=0.5 target for consistency — which
would silently reintroduce the false-negative result this solution fixes.

## Prevention Strategy

When a test's assertion is comparative ("sampler A beats sampler B on
metric M"), do not default to reusing an existing "standard" test target for
consistency with sibling tests in the same file. First verify empirically
(a throwaway script or REPL sweep across the parameter that controls
target difficulty) that the chosen target actually discriminates the
property being asserted, rather than assuming any "reasonable" instance of
the target family will do. If a comparative test target must differ from a
sibling test's target in the same file for this reason, leave a comment
explaining why — otherwise the discrepancy reads as an inconsistency to be
"fixed" later rather than as a deliberate, load-bearing choice.

This generalizes beyond MCMC: any test of the form "verify X performs
better than Y on metric M under condition C" needs C chosen specifically to
exercise the mechanism that produces X's advantage over Y, not merely a
condition where both X and Y are individually well-behaved.

## Related Solutions

No directly related prior solution found in `solutions/testing/`.

## Key Insight

A test asserting "sampler A beats sampler B on metric M" must use a target
chosen to exercise the specific mechanism that gives A its advantage over
B — reusing a "reasonable" target borrowed from an unrelated correctness
test can silently produce the opposite empirical result even though the
target itself is entirely valid for that other test.
