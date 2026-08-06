---
date: 2026-08-06T15:20:00Z
category: "distribution"
problem: "Skellam(mu1, mu2).pdf(x) returned NaN for highly asymmetric mu1/mu2 near the mean"
status: complete
related_issue: "#1321"
related_plan: "thoughts/plans/2026-08-06-1330-skellam-pdf-nan-asymmetric-mu.md"
tags: [skellam, bessel, log-space, overflow, underflow, cancellation, precision-gate, tolerance-override, distribution]
---

# Solution: Skellam pdf NaN for highly asymmetric mu1/mu2, fixed via unconditional log-space combination

**Date**: 2026-08-06
**Category**: distribution
**Related Issue**: #1321

## Problem

`Skellam(mu1, mu2).pdf(x)` returned `NaN` for highly asymmetric `mu1`/`mu2` near the distribution's mean — e.g. `Skellam(1000, 1).pdf(999)`, `Skellam(2000, 1).pdf(1999)`, `Skellam(5000, 1).pdf(4999)` — even though the true probability is a small but perfectly ordinary finite number (`variance = mu1 + mu2 ≈ 1001`, `std ≈ 31.6`, so `x=999` sits well within a few standard deviations of the mean, with a true pmf around 0.0126).

## Root Cause

`Skellam._pdf` computed the density as a product of three independently-materialized floating-point factors: `expNegScaled * Math.pow(sqrtRatio, x) * besselIExpScaled(|x|, twoSqrtProd)`. For `Skellam(1000,1).pdf(999)`: `expNegScaled = exp(-(√1000-1)²) = exp(-937.75)` underflows to exactly `0`; `Math.pow(sqrtRatio, 999)` overflows to `Infinity`; `besselIExpScaled(999, 63.25)` *also* underflows to exactly `0` — correctly, since the true value of `exp(-x)·I_n(x)` at Bessel order `n=999` far exceeding argument `x=63.25` is genuinely ~1e-1092, below `Number.MIN_VALUE`. None of the three factors is individually wrong; the product of `0 * Infinity * 0` is `NaN` in JS (in fact `0 * Infinity` alone is already `NaN`, independent of the third term), even though the true combined product is representable.

A doc comment inherited from a prior fix (#1309) claimed the `expNegScaled` term "never underflows the way `exp(-mu1-mu2)` alone does" — true only for the *symmetric* `mu1≈mu2` case #1309 actually addressed (where `(√mu1-√mu2)²` stays small), but silently repeated as if it were a general invariant. It is not: `(√mu1-√mu2)²` is unbounded as the split between `mu1` and `mu2` grows more asymmetric, independent of `mu1+mu2`'s absolute size. This is the same failure *class* the besselInu solution names ("check the intermediate's value range, not just the final answer's"), but here it manifests as three separately-scaled multiplicative factors combined in a distribution's `_pdf`, rather than a single prefactor-times-series inside one special function.

## Fix

Rewrote `Skellam._pdf` to compute the *entire* log-density exponent — `negSumPlusZ + (x/2)*logRatio + logBesselIExpScaled(|x|, twoSqrtProd)` — as one sum, then apply a single `Math.exp()` at the end, rather than multiplying three separately-scaled doubles. This required a new special function, `logBesselIExpScaled(n, x) = log(exp(-x)·I_n(x))`, added to `src/special/bessel.js`: it delegates to the existing, unmodified `besselIExpScaled` and takes `Math.log()` of the result in the common case (bit-for-bit consistent with existing behavior, zero risk to `besselIExpScaled`'s own tests, capped at order `n=10`); only when that underflows to exactly `0` does it fall back to a convergence-checked Taylor series computed **entirely in log-space**: `n·log(x/2) − logGamma(n+1) − x + log(Σ r_k)`, using a forward recurrence `r_k = r_{k-1}·(x²/4)/(k·(n+k))` normalized against its own leading term so each `r_k` stays O(1) — never overflowing/underflowing — even though the raw Bessel series terms it's built from individually would.

An empirical surprise during implementation: the naive heuristic "`n=999 ≫ x=63`, so we're deep in a large-order asymptotic regime where 1-2 terms suffice" was wrong for every one of the issue's repro cases. The series' actual convergence-rate parameter is `x²/(4n)`, not a raw comparison of `n` and `x` — and for all four repro cases (which share `mu2=1`), `x²/(4n) ≈ mu1·mu2/(mu1−mu2) ≈ mu2 = 1`, sitting almost exactly on the series' worst-convergence boundary (the k=1 term equals the k=0 leading term in magnitude), requiring ~20-30 terms rather than 1-2 to converge to machine precision.

A second, more consequential surprise surfaced only by validating the finished implementation against `mp.dps=50` references: combining the three log-space terms trades the old overflow/NaN failure for a new, milder but real precision cost that *grows with mu1* — because `negSumPlusZ`, `(x/2)*logRatio`, and `logBesselIExpScaled(...)` are all individually `O(mu1)` or `O(mu1·log(mu1))` in magnitude while their **sum** stays `O(1)` near the distribution's mean, ordinary ~1e-16 per-term relative rounding compounds into an absolute cancellation error that grows with the term magnitudes: measured ~7e-13 relative error in the final pdf at `mu1=1000`, growing to ~6-9e-12 at `mu1=5000`. The design phase had estimated ~2.2e-16 relative error via a "single log/exp round-trip" argument — but that estimate only examined the *symmetric* `mu1=mu2` case, where `negSumPlusZ` and `logRatio` both vanish exactly to `0`; it does not generalize to the asymmetric-large-`mu1` case, where those terms are large and nonzero and must cancel against `logBesselIExpScaled`'s own large negative value. This required per-parameter-set tolerance overrides in the precision-gate generator (`1e-12` / `2e-12` / `1e-11` for `mu1=1000/2000/5000` respectively), each with an honest, named justification comment (`_LOG_CANCEL`) describing the exact mechanism, per `CLAUDE.md`'s "never a blind loosening" convention.

A third, unrelated-but-adjacent discovery while picking precision-gate test `k`-values near the mean for the `mu1=5000` case: several "obvious" choices (`k=4990`, `k=4995`, close to `mean=4999`) landed inside a **pre-existing, separate** `marcumQ` precision cliff — `cdf` relative error spiking to ~6e-9, three orders of magnitude worse than the general ~1e-11 floor, specifically when the Bessel/marcum order sits just below `mu1` in magnitude. This is unrelated to this fix's own log-cancellation issue and out of scope for #1321 (which is about `pdf`, not `cdf`/`marcumQ`); it was worked around by choosing different `k`-grid points and filed separately as issue #1348 rather than fixed here.

## Prevention Strategy

When a `_pdf`/`_pmf` is factored as a product of several independently-computed, independently-scaled terms (an `exp(...)`, a `pow(...)`, a special-function call), each term can overflow or underflow even when the true product is representable — the failure signature is specifically `0 * Infinity` (or any zero-times-infinite combination) producing `NaN` rather than a wrong-but-finite number, which makes it easy to miss in ad hoc testing but guaranteed to surface once parameters push any one factor past its float64 range. Combine the **entire** exponent in log-space and take a single `Math.exp()` at the end, rather than multiplying separately-scaled factors — matching the codebase's dominant convention for this shape (`Poisson._pdf`, `Borel._pmf`, `Delaporte._pmf`).

Do not trust a doc comment asserting "this term never underflows" without checking the parameter regime the comment's originating fix actually covered — an invariant proven for a narrower case (here, #1309's symmetric `mu1≈mu2`) does not automatically generalize to the full parameter space (here, asymmetric large-`mu1`/small-`mu2`), and a stale comment repeated as fact is exactly what let this regime go unhandled for a full release cycle.

When adding a genuinely new log-space series function (as opposed to retrofitting log-space onto an existing shared, cancellation-sensitive one — that is the besselInu precedent's separate concern), still empirically re-verify the naive "large order → fast convergence" intuition against the actual repro parameters rather than assuming a term count from an order-of-magnitude comparison; the correct smallness parameter for a Bessel-type series is a *ratio* (`x²/(4n)` here), not a raw magnitude comparison of `n` and `x`.

Finally, even a genuinely terminal, no-downstream-consumer log-space combination (the Fisher-Z precedent's "safe unconditional log-space" case) is not automatically free of precision cost: if the summed log-space terms are individually large while their *sum* stays small near the distribution's mean, ordinary per-term rounding compounds into cancellation error that grows with the term magnitudes. This must be measured against `mp.dps=50` references at the actual parameter range being shipped, not assumed away by a "terminal computation, no downstream consumer" argument alone — that argument only rules out the *besselInu*-style risk (regressing an existing cancellation-sensitive caller), not this distinct, magnitude-driven cancellation risk. Any resulting tolerance override needs an honest, named mechanism comment rather than a blind loosening.

## Related Solutions

- `solutions/distribution/2026-05-15-1921-fisher-z-pdf-log-space-overflow.md` — established the precedent of overriding `_pdf` with a direct, unconditional log-space formula. This fix follows that precedent's *shape* but for a different root cause (three independently-scaled multiplicative factors, not a change-of-variables argument saturating a parent's domain boundary), and discovers a precision caveat the Fisher-Z case didn't surface (see Prevention Strategy above).
- `solutions/special-functions/2026-07-29-0810-besselinu-negative-order-overflow.md` — the "check the intermediate's value range, not just the final answer's" framing directly explains why the *old* three-factor Skellam multiplication was broken. Its warning against *unconditional* log-space for an existing shared function does not transfer here, since `logBesselIExpScaled` is new with zero prior callers to regress.
- `solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md` and `2026-07-26-1839-bessel-i-miller-n0-margin-degeneration.md` — confirm the large-order/small-argument Bessel regime this issue targets was genuinely unexplored territory; both prior fixes targeted the opposite corners (large-argument overflow, small-`n` degeneracy).

## Key Insight

A `_pdf` written as a product of independently-scaled factors (`exp(...) * pow(...) * besselFn(...)`) can produce `NaN` via `0 * Infinity` even when every individual factor is computing its own piece correctly and the true combined answer is representable — the fix is to sum the full log-space exponent before a single terminal `exp()`, but that terminal combination is only "free" when the summed terms stay small; if they're individually large and cancel down to a small answer (as here, where each term scales with `mu1` but their sum stays O(1) near the mean), ordinary per-term rounding compounds into a real, parameter-dependent precision cost that must be measured, not assumed away.
