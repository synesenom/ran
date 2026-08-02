---
date: 2026-08-01T20:30:00Z
category: "correctness"
problem: "NoncentralT.fnm rounds to exactly 1.0/0 near the CDF boundary, silently zeroing DoublyNoncentralT._pdfPoissonMixture's per-term CDF differences at extreme parameters"
status: complete
related_issue: "1250 (follow-up to #1235, whose solution doc's Residual Limitation section flagged this exact gap)"
tags: [noncentral-t, doubly-noncentral-t, catastrophic-cancellation, tanh-sinh, quadrature, precision-gate, code-health, performance]
---

# Solution: `NoncentralT.fnm` near-boundary saturation via a direct `snm` survival sibling

**Date**: 2026-08-01T20:30:00Z
**Category**: correctness
**Related Issue**: #1250

## Problem

`NoncentralT.fnm(nu, mu, x)` (`src/dist/noncentral-t.js`) computes the noncentral-t CDF via Lenth's
AS243 series entirely in linear space (`z / 2 + phi`, both O(1)-magnitude quantities). Whenever the
true survival probability `1 - F(x)` is smaller than `Number.EPSILON`, this sum rounds to exactly
`1.0` in double precision. This is not a fixable precision bug in `fnm` itself: IEEE754 doubles
cannot represent a value closer to `1` than roughly half a ULP (`~1.11e-16`) — no internal
reformulation changes which values saturate (confirmed in #1235's own investigation: `fnm(nu, mu,
x)` for `x < 0` computes bit-for-bit identically to `fnm(nu, -mu, -x)`).

`DoublyNoncentralT._pdfPoissonMixture` (`src/dist/doubly-noncentral-t.js`, the `x*mu < 0` branch of
`_pdf`) differences two such `fnm` values per Poisson-mixture term:
`fnm(nu0+2, mu, y·sHi) - fnm(nu0, mu, y·sLo)`. At `DoublyNoncentralT(5, 5, 120).pdf(-0.7)`, the
Poisson(60) weight's significant range (`i ≈ 50-90`) drives `nu0 = nu + 2i` to `~105-190`, where both
`fnm` calls independently saturate to exactly `1.0`, silently zeroing that term's contribution. This
was #1235's own residual limitation: pdf improved from ~475x off to ~1.7x off, but no further,
because of this deeper, unfixed `fnm` floor.

## Root Cause

Confirmed via direct instrumentation: at `nu0 = 125, mu = -5, x = 3.5`, `fnm` returns exactly `1`,
while the true survival (mpmath, `mp.dps=50`) is `5.2098814549137...e-17`. The gap is destroyed by
the `phi + z/2` addition — both operands are O(1)-magnitude and individually accurate only to
`~1e-16` *absolute* precision, far coarser than the `~1e-17` *absolute* target near the boundary.

## Fix

Added `NoncentralT.snm(nu, mu, x)` — a direct survival function `P(T > x)`, computed via tanh-sinh
quadrature (`src/algorithms/tanh-sinh.js`) integrating the noncentral-t's own mixture representation:

```
P(T > x) = ∫₀^∞ 0.5·erfc((x·√(v/ν) − μ)/√2) · chi2_pdf(v; ν) dv
```

truncated to `[max(0, ν − 12·√(2ν)), ν + 12·√(2ν)]`. No sign-flip branching on `x`/`mu` is needed
(unlike `fnm`'s AS243 series) — the formula is valid directly for any real `x`, `mu`. This mirrors
how the reference generator itself (`scripts/precision-refs-continuous.py`'s `nct_cdf`) computes the
noncentral-t CDF, via direct quadrature over the same chi-squared mixture, rather than AS243.

`DoublyNoncentralT._pdfPoissonMixture` gained a private `_fnmDiff(mu, hi, lo)` helper
(`hi`/`lo` as `{ nu, x }` pairs) that computes the ordinary `fnm(hi) - fnm(lo)` difference and falls
back to `snm(lo) - snm(hi)` (note the swap: `fnm(a) − fnm(b) = snm(b) − snm(a)` since `snm = 1 −
fnm`) whenever the fallback condition below is met. `_cdf` and `NoncentralT`'s own `_pdf`/`_cdf` are
**unchanged** — explicitly out of scope for #1250 (see "Residual Scope" below).

### Three designs considered, one chosen

1. **A hand-derived closed-form two-term `f11`-based density formula**, bypassing CDF differencing
   entirely for `_pdfPoissonMixture`. Rejected: the first hand-derived attempt was measured **5x to
   828x off** from the mpmath reference — this formula is genuinely error-prone to re-derive
   correctly, a risk not visible from source-reading alone. It also would not have satisfied the
   issue's own acceptance criterion that `fnm`/a sibling method itself distinguish near-boundary CDF
   values, since it sidesteps `fnm` entirely rather than fixing anything about it.
2. **Reuse `fnm`'s existing AS243 series, recombine the top-level addition as a direct subtraction**
   (`0.5·erfc(...) − z/2` instead of `phi + z/2`, reusing the same internally-computed `z`).
   Rejected: measured to barely help the reported case (~40% error vs. the original ~42%), because
   `z`'s own building blocks (`regularizedBetaIncomplete` at the moderate-to-large `(a, b)` this
   regime exercises) already carry a ~1e-13 *relative* error floor — confirmed directly against
   mpmath: `regularizedBetaIncomplete(12.5, 63.5, 0.0893)` measured ~7e-14 relative error, an
   absolute error (~1.6e-15) comparable to or larger than the target survival itself. Recombining
   the same imprecise pieces cannot manufacture precision that was never there.
3. **Tanh-sinh quadrature over the mixture representation** — chosen. Verified against mpmath to
   ~1e-13–1e-14 relative error at individual spot checks, and to *improve* every existing
   `DoublyNoncentralT` precision-gate group's own worst-case error when substituted in (not merely
   "fixes the extreme case" — it is more accurate than the AS243 path everywhere tested). Trade-off:
   ~0.5–0.9ms per `snm` call vs. ~24µs for `fnm`'s AS243 path (see "Performance" below).

### The near-boundary fallback condition — a second design iteration mid-implementation

The first implementation triggered the `snm` fallback whenever either raw `fnm` value was within
`1e-9` of `0`/`1` (`Math.min(a, b) < 1e-9 || Math.max(a, b) > 1 - 1e-9`). This fully resolved the
reported case (relative error `7.6e-15`) and passed every existing precision-gate group — but caused
a severe, undetected-until-full-`npm test`-run regression: `test/guess.js`'s "default candidate
pool (all distributions)" test, which fits every distribution (including `DoublyNoncentralT`) to
sampled `Normal(5, 2)` data, went from ~11.7s to a 60s timeout.

Root cause: proximity of `fnm`'s raw output to `0`/`1` is driven almost entirely by `mu` (via `fnm`'s
leading `Φ(-delta)` term), independent of `nu`. During `.fit()`'s optimizer exploration, a
moderately large `mu` (~6 — nowhere near the reported extreme regime) was enough to trigger the
`1e-9` threshold on nearly every Poisson-mixture term, for *every* candidate `nu`, including small
`nu` where `fnm` has no actual precision problem (confirmed: `regularizedBetaIncomplete` at small
`(a, b)` remains accurate to full double precision). One `DoublyNoncentralT.fit()` call alone made
73,424 `snm` calls, ~50.6s of the ~53.6s total.

The fix: gate the fallback on **`nu` magnitude first** — the actual, `mu`-independent factor that
determines whether `fnm`'s series has a real precision floor — and only then on the **raw
difference's own magnitude** (not the individual operands' proximity to the boundary, which is the
wrong signal, as above):

```js
_fnmDiff (mu, hi, lo) {
  const diff = NoncentralT.fnm(hi.nu, mu, hi.x) - NoncentralT.fnm(lo.nu, mu, lo.x)
  if (lo.nu >= 30 && Math.abs(diff) < 1e-9) {
    return NoncentralT.snm(lo.nu, mu, lo.x) - NoncentralT.snm(hi.nu, mu, hi.x)
  }
  return diff
}
```

`nu >= 30` was chosen empirically: low enough to still recover full precision on the reported case
(`nu0` ranges `105`-`190` there, comfortably above `30`), high enough to exclude the small-`nu`
`.fit()`-exploration regime that has no actual precision problem. Measured outcome: the reported
case's relative error stayed at `1.15e-14` (full precision preserved), while `test/guess.js`'s
"default candidate pool" test dropped from a 60s timeout back to `~24.7s` — comfortably under its
60s budget, and only somewhat slower than the pre-fix `~11.7s` baseline (an accepted, documented
trade-off: correctness in a genuinely broken regime over raw speed in an already-uncommon branch).

**`_fnmDiff`'s own signature was also revised mid-implementation.** The initial 5-scalar-argument
form (`_fnmDiff(nuHi, nuLo, mu, xHi, xLo)`) was flagged by CodeScene's mandatory post-edit code
health check ("Excess Number of Function Arguments", threshold 4 for JavaScript) and reworked into
`_fnmDiff(mu, hi, lo)` with `hi`/`lo` as `{ nu, x }` pairs — `doubly-noncentral-t.js`'s Code Health
score returned to its pre-change baseline (9.43) after the revision, from a transient 9.14.

## Addendum: `DoublyNoncentralT._cdf` also fixed (found via bug-triage, same PR)

`_cdf` was initially left unchanged, per the issue text's explicit scope ("Any change to
`DoublyNoncentralT._pdf`'s `x*mu >= 0` branch or `_cdf` — both are already correct and untouched by
#1235"). Verifying that claim while validating the `.pdf()` fix above found it did not hold at the
issue's own reported point: `_cdf` sums `Poisson_weight_i · fnm(nu0, mu, ...)` directly (never
differenced, unlike `_pdfPoissonMixture`) and, for `x < 0`, subtracts that sum from `1` — so once a
high-weight term's `fnm` call independently saturates to exactly `1.0` (the same root cause fixed
above), the sum silently overcounts and the final `1 - z` subtraction loses the true-but-tiny
complement. Measured: `DoublyNoncentralT(5, 5, 120).cdf(-0.7)` returned `6.661338147750939e-16`
against an mpmath (`mp.dps=50`) reference of `2.6248604850536683e-16` — ~154% relative error.

This was routed through the `/build` pipeline's mandatory bug-triage stage (not filed as a separate
issue — same root cause, same PR, same `snm` building block already in hand) and fixed inline. The
fix mirrors `_fnmDiff`'s shape but for a sum rather than a difference: a new `_cdfTerm(complement,
mu, nu0, x)` helper returns `fnm(nu0, mu, x)` directly for the `x >= 0` case (no cancellation risk,
the value is used as-is) and, for `x < 0`, accumulates the complement termwise
(`sum(weight_i · (1 - fnm_i))`, mathematically identical to `1 - sum(weight_i · fnm_i)` since the
Poisson weights sum to `1`) — falling back to `NoncentralT.snm` only when a term's raw complement is
both `nu0 >= 30`-driven and already below `1e-9`. Gating on `nu0 >= 30` alone (without the
raw-complement-magnitude check) was tried first and reproduced this fix's own documented performance
trap by a different path: `nu0 = nu + 2i` grows past `30` on nearly every significant Poisson-mixture
term once `theta` is large, regardless of whether that specific term is actually near the boundary,
regressing `test/precision-continuous.js`'s `DoublyNoncentralT([5, 2, 120])` quantile round-trip from
sub-second to a 120s timeout; adding the second-stage magnitude check (reusing `_fnmDiff`'s own
`1e-9` threshold) fixed it. `DoublyNoncentralT(5, 5, 120).cdf(-0.7)` now matches the mpmath reference
to ~9.6e-11 relative error, with `test/guess.js`'s "default candidate pool" test unaffected (~23-24s,
consistent with the `.pdf()` fix's own established baseline) and `doubly-noncentral-t.js`'s Code
Health score unchanged (9.43).

## Residual Scope

`NoncentralT._pdf` (`src/dist/noncentral-t.js`) computes its own density via the identical
`fnm`-difference identity `_pdfPoissonMixture` uses, and is therefore vulnerable to the same
saturation directly on `NoncentralT` at sufficiently extreme `(nu, mu, x)` — independent of
`DoublyNoncentralT` entirely. No concrete reported case exists for this; filed as a follow-up
investigation, #1302, rather than fixed here (the issue's own scope is written around `fnm` +
`DoublyNoncentralT`, and this risk is unconfirmed — code-inspection only, no failing case measured).

`scripts/precision-refs-continuous.py`'s `TEMPLATE` string (the literal describe/it wrapper it would
regenerate) has drifted from what is actually committed in `test/precision-continuous.js` — the
committed file supports per-group `pdfTol`/`cdfTol`; the script's `TEMPLATE` does not. This means a
`--emit` run right now would silently regress every existing `cdfTol`-dependent group's semantics
(e.g. `[5, 2, 120]`, `NoncentralChi2([270, 64])`). Discovered while investigating why `x = -0.7`
could not simply be added to `DNCT_XVALS`; not fixed here (unrelated, pre-existing, out of scope),
flagged for bug-triage.

`snm`'s tanh-sinh quadrature loses precision for very small `nu` independent of how extreme `x`/`mu`
are (`snm(1, 0, 0)`, exactly `0.5`, measured only ~1e-4 to 1e-7 relative accuracy across several
tried sigma multipliers and a domain-split-at-`nu` variant). Verified to not affect any parameter
combination currently exercised by any precision-gate group or the new `nu >= 30` fallback gate
(which never invokes `snm` below `nu = 30`); documented in `snm`'s JSDoc as a known, narrower-than-
`fnm` domain limitation rather than solved.

## Prevention Strategy

- **A threshold validated only against precision-gate groups is not validated against performance.**
  The original plan for this fix explicitly flagged "should be sanity-checked against any existing
  performance-sensitive test" as a risk — and the full `npm test` run (not just the targeted
  precision tests) is what surfaced the regression. Any fix introducing a conditional expensive
  fallback must be checked against the full suite, including tests that exercise `.fit()`/
  optimization loops over many candidate parameters, not just the specific reported reproduction.
- **"Is this output close to a boundary" is a different question from "was this computation
  accurate."** The first threshold design conflated the two: `fnm`'s raw proximity to `0`/`1` is
  driven by `mu` alone (via `Φ(-delta)`), while the actual precision floor is driven by `nu`
  (via `regularizedBetaIncomplete`'s degrading precision at large `(a, b)`). A boundary-proximity
  check that ignores *why* the computation might be imprecise will trigger far more often than
  necessary.
- **Code health checks are not a formality — the first `_fnmDiff` draft failed one immediately.**
  The 5-argument signature was caught by the mandatory post-edit CodeScene check before it shipped,
  not discovered later; grouping related scalars into a `{ nu, x }` pair object was a two-line fix.

## Addendum: the "fully resolve... zero regression" claim narrowed (#1298)

The Prevention Strategy above validated the `nu0 >= 30 && |raw value| < 1e-9` gate against *this
issue's own reported case* (`x = -0.7`) and the full test suite as it stood then. Issue #1298 found
that claim was accurate for that specific case but incomplete as a *general* statement about
`fnm`-saturation trustworthiness: at shallower `x` (`-0.1`, `-0.2`), a raw `fnm` value can become
untrustworthy a second, structurally independent way this gate cannot see — an operand that has
*resolved off* `phi` (so the magnitude gate correctly leaves it alone) but never separated from
`phi` in the first place is a different failure mode than a value that separated and then re-
saturated toward the opposite boundary, and the two require independent checks. `_fnmDiff`/`_cdfTerm`
now OR a direct `phi`-equality check alongside this gate, which is retained unchanged (this doc's own
reported case, `x = -0.7`, still passes against it). See
`solutions/correctness/2026-08-02-2100-noncentral-t-fnm-dual-saturation-mechanism.md` for the full
mechanism and the regression this doc's own gate-replacement risk (a naively "more precise" check
turning out not to be a superset of the one it replaces) actually caused mid-implementation.

## Related Solutions

- `solutions/correctness/2026-07-31-1300-doubly-noncentral-t-pdf-cancellation-x-mu-negative.md` —
  the #1235 fix whose "Residual Limitation" section is this issue's origin.
- `solutions/correctness/2026-08-02-2100-noncentral-t-fnm-dual-saturation-mechanism.md` (#1298) —
  closes two further blind spots in this doc's `_fnmDiff`/`_cdfTerm` gate; see the Addendum above.
- `solutions/special-functions/2026-05-18-1212-noncentral-chi2-cdf-complementary-marcum-q.md` (#245)
  — the direct precedent for this fix's shape (`marcumQ`/`marcumP`): a special function's hidden
  `1 - tiny` branch, fixed by exposing a genuine complementary computation the call site switches to.
- `solutions/correctness/2026-07-30-1907-reciprocal-inverse-gaussian-cdf-cancellation.md` and
  `solutions/special-functions/2026-06-05-0000-inverse-gaussian-cdf-erfc-cancellation-cf-convergence.md`
  — the `InverseGaussian._survival`/`ReciprocalInverseGaussian._cdf` precedent for "call a dedicated
  direct-complement method, never `1 - primary(...)`," followed here by `snm`/`_fnmDiff`.

## Key Insight

A complementary method that is mathematically correct and independently verified against an
external reference can still cause a severe regression if the *trigger condition* deciding when to
use it is based on the wrong signal. Here, "how close is the raw output to the boundary" felt like
the natural check, but the boundary-proximity itself is driven by a parameter (`mu`) unrelated to
*why* the underlying computation loses precision (`nu`'s effect on `regularizedBetaIncomplete`) —
so it fired on cheap, correct, ordinary evaluations just as readily as on the genuinely broken ones.
The right question was never "is this near 0 or 1?" but "is this specific computation, for these
specific parameters, actually untrustworthy?"
