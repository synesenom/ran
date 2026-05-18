---
date: 2026-05-18T07:12:20Z
category: "testing"
problem: "Seven noncentral distributions lacked refVals; no single third-party tool covers the family (NoncentralBeta absent from scipy 1.17, DoublyNoncentral family requires sadists which was unreachable, NoncentralChi requires a non-obvious sqrt transform, DoublyNoncentralT mixture has a non-obvious scaling factor)"
status: complete
related_issue: "#133"
related_plan: "thoughts/plans/2026-05-18-0605-issue-133-noncentral-refvals.md"
tags: [refVals, noncentral-distributions, poisson-mixture, sqrt-transform, noncentralT-degeneracy, ncbeta-scipy-missing, doubly-noncentral, scaling-factor, cross-validation-workflow, boundary-nan]
---

# Solution: refVals for the Noncentral Distribution Family

**Date**: 2026-05-18T07:12:20Z
**Category**: testing
**Related Issue**: #133

## Problem

Seven distributions in `test/dist-cases-continuous.js` had no `refVals` entries:
`NoncentralBeta`, `NoncentralChi`, `NoncentralChi2`, `NoncentralF`, `NoncentralT`,
`DoublyNoncentralF`, `DoublyNoncentralT`. Their PDF/CDF implementations were
validated only by internal consistency (KS / χ² sampling, quantile inversion) —
no third-party cross-check that would catch a transcribed formula bug or a
parameterization drift.

The naive expectation — "just call `scipy.stats.X` and embed the numbers" — fails
for this family:
- `NoncentralBeta` is absent from `scipy.stats` in 1.17.
- The canonical R package for doubly-noncentral (`sadists`) was unreachable
  (CRAN blocked from the sandbox).
- `NoncentralChi` exists in neither scipy nor base-R as a primitive.
- `NoncentralT.cases[0] = [5, 0]` had `μ = 0`, which silently routes through
  the central-t branch in `src/dist/noncentral-t.js:63-66`, so `refVals`
  computed against `cases[0]` would never have exercised the noncentral
  code path.

## Root Cause

No single third-party tool covers the full noncentral family at 1e-9 precision in
this environment. Each distribution requires a specific independent-validation
strategy, and three of them hide non-obvious pitfalls:

1. **`NoncentralChi`** is `sqrt(NoncentralChi²)` — but with the noncentrality
   parameter **squared**. `NoncentralChi2(k, λ²)` underlies `NoncentralChi(k, λ)`.
   Easy to forget to square.

2. **`NoncentralBeta`** CDF: a naive scipy Poisson-mixture reconstruction agrees
   with R `pbeta(ncp=...)` on PDF to 16 digits but on CDF only to ~5e-9 — over
   the 1e-9 tolerance threshold. R is the canonical source.

3. **`DoublyNoncentralT`** Poisson-mixture has a per-term **scaling factor**
   `√((ν+2l)/ν)` that is easy to miss. The naive decomposition
   `Σ_l Pois(l; θ/2) · scipy.stats.nct.pdf(x; ν+2l, μ)` is **wrong by ~10%** at
   typical x. The correct derivation:

   ```
   T = (X)/sqrt(W/ν), where X ~ N(μ, 1), W ~ NCχ²(ν, θ)
   W = χ²(ν + 2L), L ~ Pois(θ/2)
   So conditional on L=l: T_l = X / sqrt(χ²(ν+2l) / ν)
                              = X · sqrt(ν / (ν+2l)) / sqrt(χ²(ν+2l) / (ν+2l))
                              = T' · sqrt(ν / (ν+2l))   where T' ~ NCT(ν+2l, μ)
   ```

   PDF transform: `f_T_l(x) = sqrt((ν+2l)/ν) · f_NCT(x · sqrt((ν+2l)/ν); ν+2l, μ)`.
   CDF: `F_T_l(x) = F_NCT(x · sqrt((ν+2l)/ν); ν+2l, μ)`.

## Fix

Five independent-validation strategies, each free of any code copied from
`src/dist/`:

| Distribution | Strategy |
|---|---|
| `NoncentralChi2(k, λ)` | `scipy.stats.ncx2.pdf(x, k, λ)`, `scipy.stats.ncx2.cdf(x, k, λ)` — direct |
| `NoncentralF(d₁, d₂, λ)` | `scipy.stats.ncf.pdf(x, d₁, d₂, λ)`, `scipy.stats.ncf.cdf(x, d₁, d₂, λ)` — direct |
| `NoncentralT(ν, μ)` | `scipy.stats.nct.pdf(x, ν, μ)`, `scipy.stats.nct.cdf(x, ν, μ)` — direct (after fixing cases[0] degeneracy) |
| `NoncentralChi(k, λ)` | sqrt-transform: `pdf = 2x · ncx2.pdf(x², k, λ²)`, `cdf = ncx2.cdf(x², k, λ²)`. **λ² is mandatory.** |
| `NoncentralBeta(α, β, λ)` | R: `dbeta(x, α, β, ncp=λ)`, `pbeta(x, α, β, ncp=λ)`. Scipy reconstruction is not precise enough. |
| `DoublyNoncentralF(d₁, d₂, λ₁, λ₂)` | DNCB transform: `pdf_DNCF(x) = (d₁/d₂) · pdf_DNCB(d₁x/(d₂+d₁x); d₁/2, d₂/2, λ₁, λ₂) / (1 + d₁x/d₂)²`. DNCB itself: double Poisson mixture `Σ_k Σ_l Pois(k; λ₁/2) Pois(l; λ₂/2) · scipy.stats.beta.pdf(y; d₁/2+k, d₂/2+l)`. Avoids `sadists`. |
| `DoublyNoncentralT(ν, μ, θ)` | Poisson mixture with scaling: `pdf = Σ_l Pois(l; θ/2) · √((ν+2l)/ν) · scipy.stats.nct.pdf(x · √((ν+2l)/ν); ν+2l, μ)`. |

Two safeguards:
- **`NoncentralT.cases[]` reorder**: inserted `{ name: 'noncentral', params: () => [5, 1] }`
  at index 0 so refVals exercise the noncentral path; kept the original
  `{ name: 'central', params: () => [5, 0] }` at index 1 for KS coverage.
- **`DoublyNoncentralF` symmetry self-check**: with `d₁ = d₂` and `λ₁ = λ₂`, the
  Poisson-mixture formula must give `CDF(1) = 0.5` exactly. Computed
  `4.99999999999999778e-01` — confirms the transform is right.

Every literal was cross-validated against `dist/ranjs.cjs.js` with
`|ranjs − ref| < 1e-9` **before** being committed. The cross-validation pass
surfaced two pre-existing NaN-at-x=0 bugs at closed-support boundaries:

- `NoncentralBeta._pdf(0)` and `._cdf(0)` → NaN (filed as **#230**).
- `DoublyNoncentralT._pdf(0)` with μ != 0 → NaN (filed as **#229**).

Plus a scope mismatch — `DoublyNoncentralChi2` listed in the issue does not
exist in the codebase, filed as **#228**.

## Prevention Strategy

For future noncentral / doubly-noncentral refVals work:

1. **Square the noncentrality for `NoncentralChi`.** When using scipy.stats.ncx2
   to validate a noncentral chi (square-root) distribution, the noncentrality
   parameter passed to `ncx2` is `λ²`, not `λ`. Encode this in a comment above
   the refVals block: `// 2x*ncx2.pdf(x^2, k, lambda^2), ncx2.cdf(x^2, k, lambda^2)`.

2. **Use R, not scipy reconstruction, for `NoncentralBeta`.** Scipy 1.17 has no
   `ncbeta`. A naive Poisson-mixture reconstruction agrees on PDF but the CDF
   drifts ~5e-9 — outside the 1e-9 tolerance. R `pbeta(..., ncp=...)` is
   canonical; the R binary is available in the sandbox.

3. **For `DoublyNoncentralT`, never omit the `√((ν+2l)/ν)` scaling factor.**
   The naive mixture `Σ_l Pois(l) · nct.pdf(x; ν+2l, μ)` is wrong by ~10% at
   typical x. Derivation: conditioning on L=l yields T = T'·√(ν/(ν+2l)), not
   T' directly. PDF transform contributes the `√((ν+2l)/ν)` factor as the
   Jacobian; both the argument and the multiplicative term need it.

4. **For `DoublyNoncentralF`, use the DNCB → DNCF transform** to avoid
   `sadists`: `pdf_DNCF(x) = (d₁/d₂) · pdf_DNCB(d₁x/(d₂+d₁x); d₁/2, d₂/2, λ₁, λ₂) / (1 + d₁x/d₂)²`.
   Verify with the symmetry self-check: when `d₁ = d₂` and `λ₁ = λ₂`, the CDF
   at x=1 must equal 0.5 exactly. If your computation gives anything else,
   the Jacobian or argument transform is wrong.

5. **Before adding refVals, check whether `cases[0].params()` is degenerate**
   for the noncentral family. `NoncentralT(ν, 0)` falls into the central-t
   branch; `DoublyNoncentralT(ν, 0, θ)` likely has a similar shortcut.
   If `cases[0]` exercises a special branch, insert a non-degenerate case at
   position 0 and keep the degenerate one at position 1. Both KS coverage and
   the noncentral code path then get tested.

6. **The cross-validation gate catches latent boundary NaN bugs.** When
   `|ranjs − ref| < 1e-9` fails at a boundary point (e.g. x=0), don't just
   skip the point — investigate, file a follow-up issue, and document the
   omission with an inline comment. Pattern: `// x = 0 omitted: ranjs X.pdf(0)
   returns NaN ... — separate pre-existing bug, see #NNN.`

7. **`DoublyNoncentralF` zero-boundary** (x=0 with d₁ > 1) returns exact 0 for
   both PDF and CDF in ranjs — safe to include in refVals as a cheap boundary
   coverage point.

## Related Solutions

- `solutions/testing/2026-05-18-0000-weibull-survival-refvals-scipy-fisk-numpy.md`
  — algebraic-equivalence pattern (when scipy lacks a direct function, find a
  change-of-variables relation). NoncentralChi's sqrt-transform and
  DoublyNoncentralF's DNCB transform are direct applications of this idea.
- `solutions/testing/2026-05-17-1206-closed-form-refvals-without-scipy.md`
  — established the cross-validation-against-built-bundle workflow, the
  `cases[0]` canonical-parameter convention, and the 1e-9 PRECISION tolerance.
- Both prior solutions noted NaN-at-x=0 bugs that this PR also surfaced for
  `NoncentralBeta` and `DoublyNoncentralT` — recurring failure mode.

## Key Insight

`DoublyNoncentralT`'s Poisson-mixture reference requires a per-term `√((ν+2l)/ν)`
scaling factor (both in the argument and as the Jacobian), because conditioning
on the Poisson index gives `T = T'·√(ν/(ν+2l))`, not `T'` — the naive unscaled
mixture is wrong by ~10% and slips silently past anyone who doesn't
cross-validate against the live bundle.
