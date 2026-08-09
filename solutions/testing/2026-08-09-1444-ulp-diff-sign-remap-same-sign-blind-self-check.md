---
date: 2026-08-09T14:44:22Z
category: "testing"
problem: "ulp_diff's IEEE-754 sign-magnitude bit remap used the wrong constant, silently masking any sign-disagreement between mpmath and ranjs, and the self-check written to catch exactly this bug couldn't, because both its cases were same-sign pairs"
status: complete
related_issue: "1264"
related_plan: "thoughts/plans/2026-08-09-1304-differential-testing-harness-special.md"
tags: [ulp, ieee754, bit-manipulation, self-check, differential-testing, sign-remap]
---

# Solution: `ulp_diff`'s sign remap used the wrong constant, and its self-check couldn't have caught it

**Date**: 2026-08-09
**Category**: testing
**Related Issue**: #1264

## Problem

A newly-built ULP-distance primitive (`_monotonic_bits` in `scripts/difftest-special.py`, part of a new differential-testing harness for `src/special/`) used the wrong additive constant for its negative-value remap: `2**64 - bits` instead of `2**63 - bits`. This collided the monotonic-order values of any two same-magnitude, opposite-sign floats — `2.0` and `-2.0` both mapped to `0x4000000000000000` — so `ulp_diff(2.0, -2.0)` silently returned `0` (perfect agreement) instead of the correct ~9.22e18 (maximally different). That is precisely the class of defect this harness exists to catch: a case where mpmath and ranjs's special functions agree on magnitude but disagree on sign (a real possibility for e.g. `besselInu(nu, x)` at negative-ish real `nu`, where the Gamma-function prefactor can flip sign) would have been reported as a flawless match.

## Root Cause

Two compounding issues, not one:

1. **The math.** IEEE 754 float64 is sign-magnitude, so the raw unsigned bit pattern is not monotonic across zero — negative floats' raw bits are numerically *larger* than positive floats'. The standard fix reflects the negative branch back around the sign-bit boundary (`2**63 - bits`), not folds it into the top of the full 64-bit unsigned range (`2**64 - bits`). The latter creates a spurious collision between equal-magnitude opposite-sign values instead of separating them.

2. **The test design.** The implementation plan explicitly called for a self-check case to "specifically catch a sign-remapping bug," and the shipped `_self_check()` faithfully implemented what the plan specified — `ulp_diff(-1.0, -1.0) == 0` and `ulp_diff(-1.0, nextafter(-1.0, -2.0)) == 1`. Both are **same-sign pairs**. For same-sign inputs, `_monotonic_bits` applies the *same* additive constant to both operands, and that constant cancels out entirely in the subtraction `abs(monotonic(a) - monotonic(b))` — so no number of same-sign test cases, however carefully chosen, can ever distinguish a correct sign-remap constant from a wrong one. The plan asked for a check that would catch this bug class but specified cases that were structurally incapable of doing so, and implementation followed the flawed specification without noticing the gap.

The bug was caught not by the shipped self-check but by a `review-correctness` subagent during the mandatory `/review` pass, which read `_monotonic_bits` by hand, independently re-derived the correct constant, and constructed a targeted cross-sign repro (`ulp_diff(2.0, -2.0)`) — confirmed by direct execution before the fix was applied. In the harness's actual configured sweep domains for this PR, no sign-disagreement happened to occur in the calibration run (the JSON report was byte-identical before and after the fix), so the bug was latent rather than yet consequence-producing — but the mechanism was live for any future domain expansion (issue #1271, the planned "extend to remaining functions" follow-up), where a negative-`nu` sign-flip case becoming the sample that lands on it was only a matter of when, not if.

## Fix

Corrected the constant to `2**63 - bits`. The self-check was hardened at the same time: an over-loose assertion (`0 < ulp_diff(5e-324, 1e-323) < 10`) was tightened to the deterministic `== 1`; a subnormal-pair-straddling-zero case that a code comment had claimed was covered but was never actually exercised was added; a near-`DBL_MAX` case was added; and — the fix that actually matters for this bug class — a genuine cross-sign assertion (`ulp_diff(2.0, -2.0) > 2**62`) was added, with an explicit comment stating why same-sign cases structurally cannot catch a wrong sign-remapping constant.

## Prevention Strategy

When a self-check's stated purpose is to catch a bug defined by an *asymmetry between branches* of a conditional or piecewise function — here, the negative-vs-non-negative branch of a bit remap — at least one test case must exercise **both branches simultaneously, in a way where a wrong per-branch constant cannot cancel out against itself**. Concretely, for any function that transforms-then-combines (remap-then-subtract, encode-then-diff, scale-then-merge), same-branch test pairs are structurally blind to a wrong per-branch constant, no matter how many edge cases they cover. When writing or reviewing such a self-check, ask explicitly, per assertion: "if this specific constant were wrong, would this assertion still pass?" — not just "does this exercise the code path." A plan or spec that names the right *intent* ("catch a sign-remapping bug") is not a substitute for verifying the *specified cases* actually have the power to detect the failure mode named.

## Related Solutions

- `solutions/testing/2026-07-29-0637-bessel-digamma-precision-gate-reference-generator-own-bugs.md` — a different flavor of the same underlying risk (sole-source validation, no independent check on the checker itself), but doesn't name this specific same-branch-cancellation mechanism.
- `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md` — "a check that has never successfully run provides zero protection"; this case is one step subtler — the check *did* run, and still provided no protection, because its cases couldn't have failed even with the bug present.
- `solutions/testing/2026-07-18-1641-ess-geyer-ipsm-pairing-offset-self-consistent-wrong-tests.md` — a wrong-but-self-consistent belief surviving red-green TDD; here the belief ("same-sign cases catch sign bugs") was embedded in the plan itself and carried through unchallenged into the implementation.

## Key Insight

A test whose two operands pass through the same code branch cannot detect an error in that branch's own transformation constant, because the error cancels out in the comparison — a self-check for a remap-then-combine primitive needs a genuine cross-branch case, not just same-branch edge cases, to actually catch a wrong per-branch constant.
