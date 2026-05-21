---
date: 2026-05-21T07:24:00Z
category: "special-functions"
problem: "marcumQ/marcumP were accurate only for x < 30; the asymptotic, recurrence and quadrature branches existed only as bit-rotted scaffolding"
status: complete
related_issue: "#253"
related_plan: "thoughts/plans/2026-05-21-0600-marcum-q-four-branches.md"
tags: [marcum-q, special-functions, recessive-solution, recurrence-instability, continued-fraction, quadrature, romberg, catastrophic-cancellation, asymptotic-series, neumaier]
---

# Solution: marcumQ/marcumP four-branch implementation

**Date**: 2026-05-21T07:24:00Z
**Category**: special-functions
**Related Issue**: #253

## Problem

`marcumQ` and `marcumP` were accurate only for `x < 30`. Three of the four
numerical branches of Gil, Segura & Temme (arXiv:1311.0681) — the large-ξ
asymptotic expansion (§4.1), the three-term recurrence (§2.2 Eq. 14), and the
trapezoidal quadrature (§5) — existed only as commented-out, bit-rotted
scaffolding. Calls with `x ≥ 30` silently fell through to the series branch,
which is inaccurate or truncates there, so the Rice, NoncentralChi2,
DoublyNoncentralChi2 and Skellam CDFs were wrong outside the small-`x` regime.

## Root Cause

Activating the branches surfaced six distinct numerical failures:

1. **Recessive-solution instability.** The `Φ_n` functions of §4.1 (Eq. 36) are
   the *recessive* (minimal) solution of their recurrence. Forward iteration
   from `n = 0` amplifies the dominant homogeneous component by ~`e^{σξ}`, so
   for `σξ ≳ 10` the result was wrong by factors of ~1000. The scaffolding's
   `TODO: reverse iteration for numerical stability` named the problem but
   never fixed it.

2. **Premature asymptotic-series truncation.** The factor
   `A_n(μ−1) − A_n(μ)/ρ` crosses zero exactly once mid-series, producing a
   single spuriously tiny term; a stop-when-negligible rule truncated there
   (≈2% error) instead of at the true optimal truncation.

3. **Wrong integrator.** The quadrature integral was first wired to `romberg`,
   which returned `0` silently: Romberg's Richardson extrapolation demands
   machine-epsilon convergence that a sharply-peaked integrand needing
   `> 2¹⁴` nodes can never reach (the trapezoidal sum's own rounding noise
   floors near `1e-12`).

4. **Quadrature pole on the transition line.** When `y ≈ x + μ` the quadrature
   integrand has a genuine pole (`r(0) − 1 → 0`). The paper avoids it by never
   using quadrature inside the transition band; issue #253's dispatcher spec
   routed `μ ≥ 135` in-band points to quadrature (dropping the paper's §4.2
   large-μ asymptotic), producing `NaN`.

5. **Catastrophic cancellation in the saddle variable `ζ`.** The raw formula
   for `½ζ²` subtracts nearly-equal `O(1)` quantities near the transition line.

6. **Recurrence seed bug.** The backward P-recursion needs two seeds at two
   *distinct* orders; the scaffolding called `_pqTrap(mur, x, y)` twice with
   identical arguments, and the loop bound `n < n3 − 1` stopped one order short.

## Fix

- **Φ_n:** added `_phi` — the Legendre continued fraction for the incomplete
  gamma `Γ(½−n, σξ)` — evaluating each `Φ_n` independently when `σξ ≥ 5`;
  cheap forward recursion is kept only below that threshold.
- **Truncation:** stop only after *two consecutive* negligible terms, so the
  single mid-series near-zero term does not trigger an early exit.
- **Integrator:** wrote `src/algorithms/trap.js`, a doubling trapezoidal rule
  with Neumaier-compensated summation. The integrand vanishes with all
  derivatives at the endpoints, so the plain trapezoidal rule is already
  spectrally accurate — Richardson extrapolation is counter-productive.
  Integration is clipped to the peak's support `[0, 14/√(μ·wxis)]` to bound
  the node count.
- **Transition band:** the recurrence branch covers the band for *all* μ, not
  just `μ < 135`, so quadrature is never evaluated at the pole. (The paper's
  §4.2 large-μ asymptotic is the alternative; it is out of scope for #253.)
- **`_zetaxy`:** `½ζ²` is reassembled so every term is `O(eps²)` with
  `eps = xs − ys + 1`, removing the cancellation algebraically.
- **Recurrence seeds:** two distinct seed orders `mur` and `mur+1`; loop runs
  exactly `n3` steps to land on order μ.

Cross-validation oracle note: `scipy.stats.ncx2` is itself inaccurate in the
deep tail (~`1e-3` error for probabilities ~`1e-240`); the deep-tail checks
used an extended-precision convergent series instead.

## Prevention Strategy

- **Classify every recurrence solution as dominant or recessive before
  iterating it.** Dominant solutions may be computed by forward recurrence;
  recessive (minimal) solutions must use backward recurrence (Miller's
  algorithm) or an independent per-term evaluation (continued fraction,
  integral representation). A `TODO` about recursion direction is a signal
  this classification was skipped — treat it as a blocker, not a nicety.
- **Match the integrator's convergence criterion to the integrand.** For an
  integrand that vanishes with all derivatives at the endpoints, the plain
  doubling trapezoidal rule converges geometrically; Romberg's epsilon-level
  Richardson demand is unmeetable once summation noise floors. Do not default
  to `romberg` for smooth endpoint-vanishing integrands.
- **A dispatcher that drops one of the source algorithm's branches must
  re-prove full, correct coverage** — a branch valid only "outside a domain"
  cannot silently absorb that domain.
- **Validate against an oracle only where the oracle itself is accurate;**
  in deep tails, use an exact convergent series at extended precision.

## Related Solutions

- `solutions/special-functions/2026-05-18-1212-noncentral-chi2-cdf-complementary-marcum-q.md`
  (#245) — established the paired `marcumQ`/`marcumP` exports and the
  compute-the-small-tail-directly rule; this work routes both through a single
  `{p, q}` dispatcher that upholds it for all four branches.
- `solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md`
  (#211) — same family of regime-crossover and cancellation concerns.

## Key Insight

Forward iteration of the *recessive* solution of a recurrence amplifies the
dominant component exponentially — for the Marcum-Q `Φ_n` recurrence this gave
~1000× errors — so a recessive sequence must be obtained by backward recurrence
or an independent continued fraction, never by naked forward iteration.
