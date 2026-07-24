---
date: 2026-07-24T14:56:47Z
category: "testing"
problem: "precision-refs-continuous.py's chi2_pdf/ncbeta_pdf hardcoded pdf(0)=0 at the left support edge, and the issue's own fix scope was mathematically insufficient for the Chi case"
status: complete
related_issue: "#1116"
related_plan: "thoughts/plans/2026-07-24-1410-chi-noncentralbeta-pdf0-boundary.md"
tags: [self-check, precision-refs, chi, noncentral-beta, boundary-limit, zero-times-infinity, mpmath, dead-code-scope]
---

# Solution: Chi/NoncentralBeta pdf(0) boundary limit — a 0·∞ composition trap the issue's own scope missed

**Date**: 2026-07-24
**Category**: testing
**Related Issue**: #1116

## Problem

`scripts/precision-refs-continuous.py` (the mpmath-based reference generator that vets `refVals`
already hand-authored in `test/dist-cases-continuous.js` via `self_check()`) computed the
left-boundary (`x = 0`) pdf value incorrectly for two distributions: `chi2_pdf` and `ncbeta_pdf`
both hardcoded `mpf(0)` at `x <= 0` regardless of shape parameters, when the true closed-form
limit there is sometimes `0`, sometimes finite nonzero, and sometimes `+inf` (a genuine density
pole). This surfaced as two `self_check()` mismatches (`Chi[1] pdf(0) got 0.0 want
0.7978845608028654`; `NoncentralBeta[1,5,10] pdf(0) got 0.0 want 0.03368973499542734`) — visible
only after issue #1110 fixed `self_check()`'s broken invocation path so it could run at all (see
`solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md`).

## Root Cause

Two distinct causes stacked:

1. `chi2_pdf`/`ncbeta_pdf` never implemented the same three-way boundary branch (`shape >
   threshold → 0`, `== threshold → finite closed form`, `< threshold → +inf`) that an existing
   sibling function in the same file, `ncx2_pdf`, already used correctly at its own `v == 0`
   branch. An omission, not a math error in what little code existed.

2. **More subtly, the issue's own stated scope was mathematically incomplete.** The issue asked
   to fix `chi2_pdf` alone so it "returns nonzero finite" at `v=0, df=1`. That's wrong:
   `chi2_pdf(df=1, v=0)` is a genuine `+inf` density pole — the chi-squared density with 1
   degree of freedom is unbounded at 0. The finite value (`sqrt(2/pi)`) belongs to `pdf('Chi',
   k, x)`, which computes `2 * x * chi2_pdf(k, x*x)` as a literal, non-lazy expression. Fixing
   `chi2_pdf` alone turns `2 * 0 * chi2_pdf(1,0)` into `2 * 0 * inf`, and I verified directly
   that `mpmath.mpf(0) * mpmath.inf` evaluates to `nan` — which is *worse* than the original
   silently-wrong `0` (a numeric mismatch becomes a crash/NaN instead). The true `0·∞` limit only
   exists at the level of the algebraically-simplified product (`2·x^(k-1) /
   (2^(k/2)·Γ(k/2))`, taken as `x → 0`), not as a value either factor can return in isolation.

## Fix

Three coordinated edits, all confined to the same dev-only script:

1. Gave `chi2_pdf` its own mathematically correct boundary value — a three-way branch (`df > 2 →
   0`, `df == 2 → 1/2`, `df < 2 → +inf`) mirroring `ncx2_pdf`'s existing pattern — correct on its
   own terms, independent of any caller.
2. Added a **second, separate** `x == 0` special case directly at the `'Chi'` pdf dispatch site,
   bypassing the `2 * x * chi2_pdf(...)` formula entirely at that one point and returning the
   pre-derived closed-form limit (`sqrt(2/pi)` for k=1, `0` for k>1 — k<1, which would be `+inf`,
   is unreachable since `Chi`'s k is always a rounded positive integer here). This is necessary
   *specifically* because the multiplication formula cannot numerically evaluate a `0·∞`
   indeterminate form — no value returned by `chi2_pdf` in isolation can make
   `2 * x * chi2_pdf(k, x*x)` correct at the exact point `x = 0`.
3. Fixed `ncbeta_pdf`'s boundary directly — self-contained, no downstream multiplier trap, since
   it sums its Poisson-mixture terms directly rather than as a product with a vanishing outer
   factor. Three-way branch on `a` (`> 1 → 0`, `== 1 → e^(-λ/2)/B(1,b)`, `< 1 → +inf`).

Two independent design-review passes (design-propose + design-critique) confirmed the `'Chi'`
dispatch fix should be an inline `if x == 0: return <limit>` guard — matching an existing
in-file precedent (`'Slash'`'s identical inline-guard structure) — rather than a named helper or
a single-line ternary, since no other caller in scope would share it (`'NoncentralChi'` has the
identical structural trap but was explicitly triaged as a separate, out-of-scope latent bug
rather than folded in here — see `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md`
for the precedent of triaging sibling discoveries rather than absorbing them).

The right-edge (`x >= 1`) boundary of `ncbeta_pdf` was deliberately left untouched as a known
separate, out-of-scope bug (flagged inline, not fixed) — filed as its own follow-up issue rather
than silently expanding this PR's scope.

## Prevention Strategy

When a reference/verification function `f(x)` is combined with an outer transform `g(x) *
f(h(x))` where `g(x) → 0` at the same point where `f` has a pole, **fixing `f`'s boundary value
alone is not sufficient and can make things worse** (`0 * inf = nan` in both mpmath and native
floating point — verified directly, not assumed). The outer dispatch/composition site needs its
own independent closed-form special case at that boundary point, derived from the algebraic
limit of the *whole product*, not the naive per-factor evaluation. When scoping a fix like this:

- Before trusting an issue's stated fix location, verify the literal expression at the boundary
  point actually produces the claimed result — don't assume "fix the inner function" is
  sufficient just because that's where the wrong value originates.
- Grep for the same `<coefficient> * <fn>(...)` idiom elsewhere in the file once you've found one
  instance of this trap — it tends to recur across sibling distributions built the same way
  (`'Chi'`/`'NoncentralChi'` both wrap a chi-squared-family pdf via `2*x*...`). Triage siblings
  found this way as separate issues rather than silently expanding scope.

## Related Solutions

- `solutions/testing/2026-07-24-1141-precision-refs-self-check-never-ran.md` — the parent fix
  (issue #1110) that made `self_check()` actually run for the first time, surfacing this bug (and
  siblings #1115, #1117, plus two more latent bugs triaged out of this PR: the `'NoncentralChi'`
  x=0 NaN trap and `ncbeta_pdf`'s symmetric right-edge boundary bug).

## Key Insight

A boundary-value bug reported at one function in an expression tree may not be fixable at that
function alone — when its value is combined with a factor that itself vanishes at the same point
(`g(x)·f(x)` with `g→0`, `f→∞`), the correct fix requires a second, independent closed-form
special case at the composition site, because `0 * inf` evaluates to `nan`, not the true limit,
in floating/arbitrary-precision arithmetic alike.
