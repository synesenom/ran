---
date: 2026-08-11T20:26:32Z
category: "tooling"
problem: "A naive linear/additive bracket-expansion-then-bisection mpmath inverse-CDF solver silently returned wrong (even negative) reference values across wide-magnitude domains"
status: complete
related_issue: "#1269"
related_plan: "thoughts/plans/2026-08-11-1900-quantile-accuracy-sweep.md"
tags: [tooling, differential-testing, mpmath, quantile, bracket-search, bisection, numerical-precision, reference-values, gamma, beta]
---

# Solution: Naive linear bracket search fails across wide-magnitude domains in the mpmath quantile reference

**Date**: 2026-08-11T20:26:32Z
**Category**: tooling
**Related Issue**: #1269

## Problem

While writing `mpmath_quantile()` — the new quantile-accuracy harness's own independent mpmath-based inverse-CDF reference for the pilot-family absolute-accuracy metric (`scripts/difftest-quantile.py`) — a first implementation used a naive linear/additive bracket-expansion-then-bisection strategy, seeded from ranjs's own `q(p)` (`x0`) and expanding the bracket by a fixed additive step that doubles each iteration.

This produced a silently wrong reference: for `Gamma(alpha=0.0208, beta=0.0853)` at `p=2.37e-5`, ranjs's `q(p)` returned `1.1e-221` — independently verified correct (`gamma_cdf(params, 1.1e-221) - p ≈ 2.97e-20`) — but the naive mpmath bracket-and-bisect "reference" returned `-3.1e-61`, a negative value in a domain that is strictly positive. Had this shipped, it would have produced a false-positive "ranjs is wrong" finding, corrupting the very harness meant to catch real defects.

## Root Cause

For a domain bounded at 0, an additive bracket step of `max(abs(x0), 1) = 1` (since `x0` is tiny, `1.1e-221`) immediately overshoots past the boundary into negative territory (`x0 - step ≈ -1`). Once the bracket spans a huge range of magnitudes (`a=-1`, `b=1.1e-221` — a 221-order-of-magnitude gap), bisection at any *fixed* decimal precision (`mp.dps=50`) cannot resolve the true root's actual scale: `(a+b)/2` at 50 significant digits loses `b`'s contribution entirely once `a` and `b` differ by more than roughly 50 orders of magnitude, so `(a+b)/2 ≈ a/2` exactly at every step (manually traced and confirmed). The bisection converges toward `0` from the `a` side and produces a numerically plausible-looking but arbitrarily wrong answer — arithmetic precision, not iteration count, is the limiting factor.

## Fix

Reparameterized the bracket search to operate in a transformed coordinate whose *linear* increments correspond to the domain's *multiplicative* scale: log-space (`y = ln(x)`, bisecting on `y`) for domains bounded at 0 and unbounded above (Gamma, Chi2, F, InverseGamma), and logit-space (`y = ln(x/(1-x))`) for `(0,1)`-bounded domains (Beta). This makes the bracket search well-conditioned regardless of how many orders of magnitude separate the seed `x0` from the true root, because it is the *exponent* that stays well-scaled under the transform, not the raw value. A third, untransformed linear branch remains for domains without a fixed finite boundary at magnitude-scale risk (e.g. StudentT).

Verified: the Gamma case above now round-trips correctly, and a self-check (`_formula_self_check_quantile()` in `scripts/difftest-quantile.py`) forces genuine bracket expansion through all three branches (log-space, logit-space, linear) against independently-known closed-form identities, all passing.

## Prevention Strategy

Any new bracket-expansion-plus-bisection root finder — whether in production (`_qEstimateRoot` and friends already handle this correctly via golden-ratio multiplicative expansion, and were the design mirror here) or in a diagnostic/reference tool being written fresh — must choose its bisection coordinate based on the domain's *shape*, not just its endpoints: a domain bounded at 0 (or any single finite boundary with the root potentially many orders of magnitude away) needs log-space bisection; a `(0,1)`-bounded domain needs logit-space; only a domain where the root's distance to the seed stays within a handful of orders of magnitude is safe for plain linear bisection.

When writing a *reference* solver meant to independently validate an existing one, the danger is compounded: a wrong reference doesn't crash — it looks like a legitimate second opinion and can flip a correct implementation's flag to "wrong." Any new mpmath/scipy/R reference-computation helper built for a differential-testing harness needs its own self-check against closed-form identities that are independent of both the code under test and the reference formula itself, run unconditionally before any sweep result is trusted — consistent with the codebase-wide rule that reference values must never be derived from the implementation being tested.

## Related Solutions

- `solutions/algorithm/2026-06-01-0210-chandrupatla-bracket-guard-and-brent-defects.md` — related but distinct: covers bracket-guard semantics and convergence-criterion correctness for the production Chandrupatla solver, not coordinate-space choice for a from-scratch mpmath reference solver spanning wide magnitude ranges.
- `solutions/distribution/2026-08-06-1520-skellam-pdf-log-space-cancellation-fix.md` — related in spirit (log-space arithmetic avoiding a numerical-precision failure) but a different mechanism: terminal multi-factor multiplication cancellation in a PDF, not iterative bracket-search convergence.

## Key Insight

A bisection/bracket search implemented at fixed decimal precision silently loses the far endpoint once the bracket spans more orders of magnitude than that precision has digits — bisect in log-space (or logit-space for `(0,1)` domains) whenever the root could be many orders of magnitude from the seed, and never trust a hand-rolled reference solver without a closed-form self-check independent of the code it's meant to validate.
