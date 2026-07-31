---
date: 2026-07-31T13:00:00Z
category: "correctness"
problem: "DoublyNoncentralT(nu, mu, theta).pdf(x) has catastrophic-cancellation relative error (up to ~130x observed) whenever x*mu < 0, even after the #1207 fix removed the unstable f11 recurrence from the same branch"
status: complete
related_issue: "1235 (follow-up to #1207, whose solution doc flagged this exact residual limitation as out of scope)"
tags: [doubly-noncentral-t, wynn-epsilon, catastrophic-cancellation, poisson-mixture, noncentral-t, precision-gate]
---

# Solution: DoublyNoncentralT `_pdf` catastrophic cancellation in the `x*mu < 0` branch

**Date**: 2026-07-31T13:00:00Z
**Category**: correctness
**Related Issue**: #1235

## Problem

`ran.dist.DoublyNoncentralT(nu, mu, theta).pdf(x)` returned probability densities with large
relative error whenever `x * mu < 0` (the tail on the opposite side of `mu` from `x`), even after
the #1207 fix replaced the unstable `_f11Forward`/`_f11Backward` three-term recurrence with direct
`f11()` calls in this branch. The issue's own example, `DoublyNoncentralT(5, 5, 120).pdf(-0.7)`,
returned `3.85e-12` against an independent mpmath (`mp.dps=50`) Poisson-mixture reference of
`8.08e-15` — roughly 475x off. `DoublyNoncentralT(5, 2, 120).pdf(-1.0)` returned `2.60e-7` against
a reference of `2.00e-9` — roughly 130x off. No error or warning was raised; the density was
silently wrong.

## Root Cause

`_pdf`'s `x*mu < 0` branch (`src/dist/doubly-noncentral-t.js`) summed an infinite series in index
`j`, whose `j`-th term carries a factor `(x·μ·√(2/ν))^j / j!`. When `x·μ < 0` this factor
alternates in sign every step. The implementation routed this through `wynnEpsilon`
(`src/algorithms/wynn-epsilon.js`), a series-acceleration algorithm that builds partial sums in
plain double precision and accelerates their *convergence rate*. It has no defense against
*cancellation*: when the true (converged) sum is many orders of magnitude smaller than the
individual signed terms being added — exactly the case deep in the tail opposite `μ` — the
information needed to represent the small converged value is already destroyed by the time
`wynnEpsilon` sees the partial sums, regardless of how well it extrapolates them. This was already
diagnosed and explicitly deferred in the #1207 fix
(`solutions/correctness/2026-07-30-1600-doubly-noncentral-t-pdf-f11-recurrence-instability.md`,
"Residual Limitation" section): replacing `_f11Forward`/`_f11Backward` with direct `f11()` calls
fixed a *different* problem (three-term recurrence instability) but left this cancellation problem
untouched, since correctly-evaluated per-term values cannot recover precision already lost to
alternating-sign summation in double precision.

## Fix

Replaced the `wynnEpsilon`-based alternating series with a **cancellation-free** representation:
the term-by-term derivative of the Poisson(θ/2)-mixture-of-noncentral-t formula `_cdf` already
uses in the same file. `_cdf(x) = Σ_i Poisson(θ/2, i) · NoncentralT.fnm(ν+2i, μ_signed, y·sᵢ)`,
where `y = |x|`, `sᵢ = √(1+2i/ν)`, `μ_signed = x<0 ? −μ : μ`. Differentiating term-by-term w.r.t.
`y` (chain rule through the `y·sᵢ` argument, using the same CDF-difference identity
`NoncentralT._pdf` already uses for the ordinary singly-noncentral-t density) and simplifying — the
`sᵢ` Jacobian factor introduced by the chain rule cancels exactly against the `y·sᵢ` denominator in
that identity — gives:

```
f(x) = (1/y) · Σ_i Poisson(θ/2, i) · (ν+2i) · [fnm(ν+2i+2, μ_signed, y·s_{i+1}) − fnm(ν+2i, μ_signed, y·sᵢ)]
```

This matches `scripts/precision-refs-continuous.py`'s independent `dnct_pdf`/`nct_pdf` reference
term-by-term (the reference was not derived from ranjs). Implemented as a new private method,
`_pdfPoissonMixture(x)`, using the same `recursiveSum` + `{ useFloor: false }` pattern already
proven in `_cdf` (the `{ useFloor: false }` guard is required for the same documented reason:
`exp(-θ/2)` can underflow below `EPS` before the Poisson weight's true peak for large `θ`, which
would otherwise falsely satisfy `recursiveSum`'s default absolute-floor convergence check after one
term). `_pdf`'s `x*mu < 0` branch now calls this method; the `x*mu >= 0` branch (`recursiveSum`
over direct `f11()` calls, already correct per #1207) is untouched. `wynnEpsilon`'s import was
removed (no longer used anywhere in this file).

Verified against the mpmath (`mp.dps=50`) reference for `DoublyNoncentralT(5, 2, 120)` at
`x = -0.1, -0.2, -0.3, -0.5, -0.7`: pdf now matches to ~1e-10–1e-12 relative error (previously up to
~130x off at nearby points in the same regime). A new precision-gate group covering this exact
parameter set and `x` range was added to `test/precision-continuous.js`.

## Residual Limitation (out of scope)

The issue's own example, `DoublyNoncentralT(5, 5, 120).pdf(-0.7)`, was re-measured after this fix:
`4.71e-15` vs. the mpmath reference `8.08e-15` — roughly 1.7x off, a ~280x improvement over the
pre-fix ~475x error, but still not within any tight tolerance. Root cause, confirmed by direct
instrumentation of the new sum: at `θ=120`, the Poisson(60) weight's significant region falls
around Poisson index `i≈50-70`, corresponding to `ν+2i≈105-145`. At `μ=5`, the two
`NoncentralT.fnm(ν0, μ_signed, z)` calls needed at each such `i` both evaluate to **exactly**
`1.0` in float64 (confirmed by logging every term), because the true tail probability they
represent is far below `Number.EPSILON`. Their difference — the actual per-term density
contribution — is silently `0` instead of the true (tiny but nonzero) value, for the entire
Poisson-significant range. This is not fixable by how `DoublyNoncentralT._pdf` calls `fnm`:
`NoncentralT.fnm(nu, mu, x)` for `x < 0` internally computes `1 − z_internal` where `z_internal` is
computed by the exact same algorithm as `fnm(nu, -mu, -x)` — confirmed by direct comparison, both
forms return bit-for-bit identical results — so no external reformulation (reflecting `mu`,
negating `x`, or any combination) changes which values saturate. This is a genuine
double-precision floor **inside `NoncentralT.fnm`'s handling of CDF values extremely close to 0 or
1**, orthogonal to `DoublyNoncentralT._pdf`'s branch structure, and out of scope for #1235 (which
targets the alternating-series cancellation this fix eliminates, not `fnm`'s own near-boundary
precision). The new precision-gate group therefore uses `DoublyNoncentralT(5, 2, 120)` rather than
the issue's own `mu=5` example: at `μ=2` (same `θ=120`), the `fnm` saturation described above falls
outside the Poisson weight's significant region, so this fix's improvement is demonstrable to near
full float64 precision without the `fnm` floor obscuring it. The `[5, 5, 120]` case's dramatic
improvement (475x → 1.7x) is documented here rather than gated by a test, since a tolerance loose
enough to pass it (~2x) would test almost nothing.

## Prevention Strategy

When a fix trades one cancellation-prone representation for another, re-derive and directly
instrument the new representation's individual terms at the *original* bug's exact reported
parameters before declaring victory — a formula being "cancellation-free" in the sense of "every
term is a probability-weighted, non-negative quantity" does not guarantee every *building block*
inside each term (here, `NoncentralT.fnm`) retains full relative precision across its own entire
domain, particularly near CDF values of exactly 0 or 1. `NoncentralT.fnm`'s own precision near
these boundaries is unaudited beyond what this investigation surfaced and may be worth a dedicated
follow-up if a caller ever needs it in that regime.

## Related Solutions

- `solutions/correctness/2026-07-30-1600-doubly-noncentral-t-pdf-f11-recurrence-instability.md` —
  the #1207 fix that removed the unstable `f11` recurrence from this same branch and explicitly
  flagged this cancellation problem as a distinct, deferred follow-up (this issue, #1235).
- `solutions/correctness/2026-07-28-1024-doubly-noncentral-t-cdf-recursivesum-absolute-floor-truncation.md`
  — the origin of the `{ useFloor: false }` requirement for any `recursiveSum` call in this file
  seeded with an `exp(-theta/2)`-style leading term, reused here for `_pdfPoissonMixture`.

## Key Insight

Replacing an alternating-series representation with a Poisson-mixture-of-CDF-differences
representation eliminates cancellation *at the series level* (no term is ever negative), but each
term's own CDF-difference can still lose all its information if the underlying CDF function
saturates to exactly 0 or 1 in double precision before the difference is taken — a second,
independent cancellation hazard one level down, invisible until the fix is checked at the same
extreme parameters that exposed the original bug.
