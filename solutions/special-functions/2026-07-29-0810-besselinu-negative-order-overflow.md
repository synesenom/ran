---
date: 2026-07-29T08:10:00Z
category: "special-functions"
problem: "besselInu(nu, x) returned Infinity for very negative fractional order at x near the ~710 series-overflow boundary, even though the true value is a large but finite number"
status: complete
related_issue: "#1215"
related_plan: "thoughts/plans/2026-07-29-0810-besselinu-negative-order-overflow-fix.md"
tags: [special-functions, bessel, overflow, log-exp, rescaling, recursiveSum, fractional-order, precision-gate, withheld]
---

# Solution: besselInu overflow for very negative fractional order

**Date**: 2026-07-29
**Category**: special-functions
**Related Issue**: #1215

## Problem

`ran.special.besselInu(nu, x)` (modified Bessel function of the first kind, fractional order)
returned `Infinity` for very negative fractional order (e.g. `nu = -1.5, -2.5, -3.3`) at `x` near
the ~700-710 series-overflow boundary, even though the true value is a large-but-finite double
(~1e302-1e306). For example, `besselInu(-1.5, 709)` returned `Infinity` where the mpmath
(`mp.dps=50`) reference is `≈1.2295937306183464e+306` — comfortably within double range. The
same `x` values at the corresponding *positive* orders did not exhibit the bug.

The bug had been explicitly anticipated but deferred: a prior test-infrastructure issue (#1140)
added a `WITHHELD` mechanism in `scripts/precision-refs-special.py` specifically to exclude these
8 exact `(nu, x)` points from the precision gate pending this follow-up fix. An even earlier
solutions doc
(`solutions/testing/2026-06-02-1200-besselInu-infrastructure-fix-coverage-gap.md`, issue #629)
had claimed that beyond `x≈710`, `I_ν(x) > 1.8e308` making `Infinity` the mathematically correct
result — a claim this issue disproves for sufficiently negative fractional `ν`, and which has
since been corrected in that file.

## Root Cause

`besselInu` computed `I_ν(x) = (x/2)^ν · S`, applying the `(x/2)^ν` prefactor only *after* the
shared `recursiveSum` primitive finished accumulating the unnormalized series sum `S`. For very
negative `ν`, `(x/2)^ν` is extremely small, so `S` must be proportionally *larger* than the true
finite final answer to compensate. At `x≈700-710`, `S` itself exceeded `Number.MAX_VALUE` and
overflowed to `Infinity` inside the loop — before the tiny prefactor ever got a chance to bring
the product back into representable range. `recursiveSum` has no overflow awareness (its
convergence check only compares `|delta|` to `EPS * max(|sum|,1)`), so it silently kept
accumulating on an already-infinite value.

This is the same overflow *class* previously fixed for integer-order `besselI` (issue #544,
`_besselIBackward`'s Miller-recurrence normalization), but a different algorithmic shape:
`besselInu` is a forward power series computed via the generic `recursiveSum` primitive, not a
backward recurrence with a natural normalization identity.

## Fix

Replaced the `recursiveSum` call with a hand-written loop mirroring `_besselIBackward`'s existing
overflow-guard pattern in the same file: rescale the running sum and current term in lockstep by
`EPS` whenever `|sum|` exceeds a threshold, tracking a `logScale` offset, and combine the final
answer via log-space (`Math.sign(sum) * Math.exp(nu*Math.log(x/2) + Math.log(Math.abs(sum)) +
logScale)`) — but *only* when a rescale actually occurred, using the original direct
multiplication (`Math.pow(x/2, nu) * sum`) otherwise.

Two refinements surfaced only through implementation and empirical validation, neither present
in the initial design proposals:

1. **Conditional log-space combination.** Unconditionally combining via log/exp (even when no
   rescale occurred) measurably degraded `besselKnu`'s connection-formula cancellation precision
   at `x=5.9` from ~1e-15 to ~1e-10, breaking an existing precision-gate test. The fix only takes
   the log-space path when `logScale !== 0`, preserving bit-identical precision for the
   overwhelming majority of calls that never need rescaling.
2. **Empirically-tuned rescale threshold.** Copying `_besselIBackward`'s `1/EPS` (~4.5e15)
   threshold verbatim triggered ~19-20 unnecessary rescale round-trips, since `besselInu`'s
   unnormalized sum can validly range up to ~1e298 while still being a non-buggy intermediate —
   far above `_besselIBackward`'s own value range. Each unnecessary round-trip's log/exp pair
   compounded rounding error to ~2.1e-13, right at (and for one existing case, past) the
   library's 1e-13 tolerance. A threshold near actual double overflow (`1e290`, tuned against
   mpmath `mp.dps=50` references) reduced worst-case error to ~8e-14 with comfortable margin.

A brand-new `x === 0` guard (`Math.pow(0, nu) * (1 / gamma(nu + 1))`) preserves the function's
exact pre-fix degenerate-input behavior, which the log-space combination cannot express (`0 *
-Infinity` is `NaN`). Review found two test-coverage gaps in this new code, both fixed inline:
the `x=0` guard's three sub-cases (`nu>0 → 0`, `nu=0 → 1`, `nu<0 non-integer → signed Infinity`)
had no test, and the log-space branch's `Math.sign(sum)` had only ever been exercised with
`sum > 0`. The latter was resolved by an actual numerical scan (728,535 `(nu, x)` combinations,
186,017 real rescale events) confirming `sum` is always positive at the rescale point for
realistic `nu` magnitudes, documented in-code with an honest caveat that this breaks down around
`nu ≈ -82` — far outside any caller's actual usage (`besselKnu`'s only internal use is
`nu ≈ 0.25`).

## Prevention Strategy

When a computation is factored as `tiny_or_huge_prefactor × intermediate_sum`, the intermediate
sum can overflow/underflow even when the true final answer is representable, because it must be
proportionally larger/smaller than the final value to compensate for the prefactor. Check the
*intermediate*'s value range, not just the final answer's, when deciding whether a series or
recurrence needs overflow guards — "the final answer fits in a double" does not imply "every
intermediate does too."

When adapting an overflow-guard pattern (rescale threshold, log-space combination) from a
precedent function in the same file, do not copy its threshold constant verbatim. The new
accumulator's value range may differ substantially from the precedent's, and reusing a threshold
tuned for a different magnitude range can silently degrade precision at the tolerance boundary
rather than fixing anything — validate the threshold empirically against `mp.dps=50` references
across the full affected parameter range, not just the originally-reported failing points.

Prefer combining via the original direct-multiplication formula whenever the overflow guard
didn't actually trigger, rather than unconditionally routing every call through log-space —
log/exp round-trips cost a few ULP each, and code paths with tight cancellation-sensitive callers
(like `besselKnu`'s connection formula) can regress from an unconditional "safer-looking" rewrite
that never needed to run for those callers in the first place.

## Related Solutions

- `solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md`
  — the precedent overflow-guard pattern (`_besselIBackward`'s lockstep rescale + log-exp
  combination) this fix adapted from a backward recurrence to a forward series.
- `solutions/testing/2026-06-02-1200-besselInu-infrastructure-fix-coverage-gap.md` — corrected in
  this same branch: its claim that `x≤710` always converges to a representable finite value (with
  `Infinity` "correct" beyond it) was disproven for very negative fractional order.
- `solutions/testing/2026-07-29-0637-bessel-digamma-precision-gate-reference-generator-own-bugs.md`
  — introduced the `WITHHELD` mechanism (issue #1140) this fix un-blocks.

## Key Insight

An overflow bug in `f(x) = tiny_prefactor × huge_intermediate_sum` can occur even when the true
finite answer is representable, because the intermediate sum must overflow-compensate for the
prefactor — the fix (lockstep rescale + log-space combination) should copy the general *pattern*
from an existing precedent in the same file, but must empirically re-tune the rescale threshold
and the conditions under which log-space is actually used, since blindly copying constants or
unconditionally routing through log-space degrades precision at the tolerance boundary rather
than fixing the bug.
