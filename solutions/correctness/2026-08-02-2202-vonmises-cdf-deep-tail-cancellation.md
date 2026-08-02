---
date: 2026-08-02T22:02:47Z
category: "correctness"
problem: "VonMises.cdf(x) non-monotonic in the deep tail once kappa is large enough that the true tail probability drops below double precision's cancellation floor"
status: complete
related_issue: "1320"
related_plan: "thoughts/plans/2026-08-02-2106-vonmises-cdf-deep-tail-cancellation.md"
tags: [von-mises, cancellation, tanh-sinh, quadrature, cdf, monotonicity, deep-tail, fourier-series]
---

# Solution: VonMises `_cdf` deep-tail cancellation replaced with direct quadrature

**Date**: 2026-08-02
**Category**: correctness
**Related Issue**: #1320

## Problem

`VonMises(mu, kappa).cdf(x)` returned non-monotonic values several concentration-widths into the tail once `kappa` was large enough — empirically reachable from `kappa ~ 730` — that the true tail probability at a given `x` dropped below double precision's ~1e-16 cancellation floor. E.g. `VonMises(0, 730).cdf(-0.357)` returned `2.78e-16` while `.cdf(-0.355)` returned `0`, even though `-0.355 > -0.357` and a CDF must be non-decreasing. Callers computing tail probabilities, or doing anything (e.g. bisection/root-finding) that assumes `.cdf()` is monotonic, got wrong or inconsistent results — the same class of downstream corruption a prior, unrelated `VonMises._cdf` bug caused (`solutions/correctness/2026-07-26-1339-vonmises-cdf-oscillating-term-premature-convergence.md`).

## Root Cause

`_cdf(x)` computed the CDF via the closed-form Fourier decomposition `F(x) = 0.5*(1+dx/π) + sum/π`, where both `0.5*(1+dx/π)` and the series sum are individually `O(1)` for any `dx` not extremely close to `±π`. When the true tail probability is tiny (deep tail, large `kappa`), these two `O(1)` terms nearly cancel and the result is dominated by rounding noise rather than the true small value.

A prior fix, #1308 (commit `e9cc62e`), had switched `_pdf`/`_cdf`'s Bessel calls to `besselIExpScaled` to fix an `Infinity/Infinity` overflow for `kappa ≳ 710-720`, and added a `Math.max(0, Math.min(1, ...))` clamp around `_cdf`'s result. That clamp kept the noise bounded in `[0,1]` but did not address the cancellation itself — it masked the symptom (out-of-range values) while leaving the underlying non-monotonicity untouched. #1308's own fix is also what newly made `kappa ≳ 730` *reachable* at all: before it, any `kappa` this large produced `NaN` before the cancellation-prone code path ever executed, so the bug was latent but inert until #1308 shipped.

## Fix

Replaced the Fourier series entirely with direct `tanhSinh` quadrature (`src/algorithms/tanh-sinh.js`) of the already cancellation-free `_pdf` (fixed by #1308: `exp(kappa*(cos(x-mu)-1)) / (2π·besselIExpScaled(0,kappa))`, no subtraction of comparable `O(1)` terms). Using the distribution's `pdf(mu+t) = pdf(mu-t)` symmetry, the integrand is always evaluated on the side away from the density's peak, so the combination step at the end never subtracts two comparable `O(1)` quantities either:

```js
_cdf (x) {
  const dx = x - this.p.mu
  if (dx <= 0) {
    return Math.min(Math.max(tanhSinh(t => this._pdf(t), this.s[0].value, x), 0), 1)
  }
  return Math.min(Math.max(1 - tanhSinh(t => this._pdf(t), x, this.s[1].value), 0), 1)
}
```

`dx <= 0` integrates directly from the support boundary to `x` — the result is the small tail probability itself, no cancellation possible. `dx > 0` computes `1 - tanhSinh(...)` from `x` to the boundary, where the subtracted quantity is at most `0.5` (never close to `1`), so that subtraction is also well-conditioned. This mirrors `NoncentralT._cdf` (`src/dist/noncentral-t.js:184-188`), which already uses `tanhSinh` as its *primary* CDF computation rather than a fallback — direct precedent for the pattern, not a novel technique.

Two independent AI design-review passes (a "propose" agent generating three options, a "critique" agent independently re-verifying by reading source) converged with high confidence on full replacement rather than a hybrid that would keep the Fourier series for moderate `x` and only switch to quadrature in a detected deep-tail regime. The critique agent verified directly against `src/special/bessel.js` that the old series was `O(kappa²)` (each of ~`kappa` terms requiring an `O(kappa)` Bessel backward-recurrence) — worse than the propose agent's initial `O(kappa·√kappa)` estimate — making full replacement both simpler (no threshold-tuning, no dual code path) and dramatically faster at any `kappa` above ~2. A third option — deriving a custom large-`kappa` asymptotic/saddle-point series for the tail, analogous to how `erfc` uses a continued fraction instead of `1-erf` — was explicitly rejected: no standard published reference exists for the von Mises CDF's asymptotic tail (unlike `erfc`'s DLMF 7.9.2), and this codebase has direct prior-incident evidence that hand-derived asymptotic expansions are dangerous without one (`solutions/special-functions/2026-06-14-1240-e1-asymptotic-vs-continued-fraction-crossover.md`, where a divergent asymptotic expansion for E₁(z) silently produced ~4% error).

A code-review pass on the first implementation commit caught two gaps before merge, both fixed in a follow-up commit: (1) the rewrite had dropped the `[0,1]` clamp `NoncentralT._cdf` keeps as defense-in-depth against a stray few-ULP quadrature-error excursion — restored to match that precedent, even though the invariant is now also structurally very likely true (tanhSinh sums only non-negative weights via Neumaier compensated summation); (2) the new deep-tail accuracy test only had mpmath reference values for the `dx <= 0` branch, leaving `1 - tanhSinh(...)` (`dx > 0`) with zero absolute-accuracy coverage — only the generic monotonicity sweep touched that branch, and that only checks relative ordering, not correctness. Two positive-`x` reference entries were added, derived from the existing negative-`x` mpmath values via the `cdf(x) = 1 - cdf(-x)` symmetry identity rather than a fresh mpmath computation.

## Prevention Strategy

When a closed-form CDF/probability formula is built as a difference or sum of two or more individually `O(1)` quantities (`0.5*(1+dx/π) + sum/π`, or more generally any `a + b` / `1 - f(x)` decomposition), that final combination step — not just the accuracy of each term feeding into it — is a distinct cancellation hazard whenever the true answer can be arbitrarily small (deep tail, extreme parameter regime). Fixing or verifying each `O(1)` term's own accuracy does not guarantee the combination is accurate once the true result sits far below either term's own error floor.

Prefer reformulating the small quantity as a direct accumulation of non-negative contributions — quadrature of an already cancellation-free density (as here), or a dedicated tail-specific formula (`erfc` instead of `1-erf`) — rather than subtracting two `O(1)` values and hoping the result survives below the ~1e-16 floor. When such a reformulation replaces a closed-form CDF:
- Keep a `min(max(..., 0), 1)` clamp as defense-in-depth against quadrature-error excursions, matching `NoncentralT._cdf`'s established precedent, even when the new formulation is structurally very likely already bounded.
- Write deep-tail accuracy tests that explicitly exercise **both** symmetry branches of the new implementation (e.g. both sides of a `dx <= 0` / `dx > 0` split), not just whichever branch the first batch of reference values happens to fall on — a subtraction-based branch (`1 - integral`) is exactly the kind of code a cancellation fix is meant to avoid, so it deserves its own accuracy check, not just a monotonicity sweep.
- Verify performance claims against source before trusting them as a design-decision input: an initial complexity estimate (`O(kappa·√kappa)`) understated the old series' true cost (`O(kappa²)`) here, which only surfaced because a second, independent review pass re-derived it from the actual recurrence-depth formula rather than trusting the first pass's estimate.

## Related Solutions

- `solutions/correctness/2026-07-26-1339-vonmises-cdf-oscillating-term-premature-convergence.md` — a different `VonMises._cdf` bug (premature Fourier-series truncation at `x = k·π/4`, fixed by checking the convergence envelope instead of the raw oscillating term). Not superseded by this fix: the specific bug it addressed can no longer recur since the whole series is deleted, but its prevention-strategy lesson ("check non-oscillating envelopes, not raw oscillating terms, for series convergence") remains independently valid for other series-based code in this codebase.
- `#1308` (commit `e9cc62e`, "VonMises pdf/cdf overflow at large kappa fixed") — immediate prior context. Its `besselIExpScaled` switch and `[0,1]` clamp fixed `Infinity/Infinity` overflow and suppressed the visible out-of-range symptom, but left the cancellation this issue closes unaddressed — and is what newly exposed it, by making large-`kappa` results finite instead of `NaN`. #1308 has no standalone solution doc of its own (only inline comments and a CHANGELOG bullet); this document is the first place the full #1308 → #1320 narrative is captured.
- `solutions/algorithm/2026-06-01-1002-tanh-sinh-neumaier-empty-array-and-trap-replacement.md` — the `tanhSinh` quadrature primitive itself, reused here unmodified.
- `solutions/special-functions/2026-06-14-1240-e1-asymptotic-vs-continued-fraction-crossover.md` — the basis for rejecting a hand-derived large-`kappa` asymptotic series as an alternative fix: no published reference exists for the von Mises CDF tail, and this codebase has direct evidence such expansions silently produce large errors without one.

## Key Insight

A final `a + b` (or `1 - f(x)`) combination of two independently-accurate `O(1)` terms is itself a distinct cancellation hazard from series-truncation bugs — fixing or verifying the accuracy of each term individually does not guarantee the combination is accurate once the true result is far smaller than either term, and the correct fix is to avoid forming the combination at all (direct quadrature or a tail-specific formula) rather than to compute it more precisely.
