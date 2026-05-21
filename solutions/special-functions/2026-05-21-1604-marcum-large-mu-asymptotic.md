---
date: 2026-05-21T16:04:55Z
category: "special-functions"
problem: "the printed coefficients of a published asymptotic expansion fell five orders short of the accuracy target at the routing boundary"
status: complete
related_issue: "#315"
related_plan: "thoughts/plans/2026-05-21-1500-marcum-large-mu-asymptotic.md"
tags: [marcum-q, special-functions, asymptotic-expansion, large-mu, saddle-point, coefficient-generation, offline-generator, sympy, mpmath, truncation-error, eslint-no-loss-of-precision]
---

# Solution: large-µ asymptotic expansion for the Marcum Q-function (§4.2)

**Date**: 2026-05-21T16:04:55Z
**Category**: special-functions
**Related Issue**: #315

## Problem

`marcumQ` / `marcumP` routed the transition band `y ≈ x + µ` through the
three-term backward recurrence (`_recurrence`) for **all** µ. For `µ ≥ 135`
that recurrence takes `O(µ)` steps and accumulates rounding error. Gil, Segura
& Temme (arXiv:1311.0681) cover this regime with a dedicated `O(1)` method —
the §4.2 large-µ uniform asymptotic expansion — which had been left
unimplemented as the fifth and final computation branch of the source
algorithm.

## Root Cause

The §4.2 expansion is `Q ≈ √(µ/2π)·Σ_j A_j·Ψ_j(ζ) − T` with
`A_j = Σ_k f_{jk}/µ^k`. Its hard input is the asymptotic coefficient set
`f_{jk}` — polynomials in `u = 1/√(2x/µ+1)` derived by a saddle-point
series-reversion (the paper's §4.6.2).

**The paper prints only 10 of these coefficients** (Eq. 90, the `j+k ≤ 3`
subset). Those 10 give a truncation error of `O(µ⁻²) ≈ 5×10⁻⁵` at the routing
boundary `µ = 135` — **five orders of magnitude short of the required
`1×10⁻¹⁰`**. This is a silent trap: an implementation that faithfully
transcribes what the paper prints, and is spot-checked only at large µ (where
the `1/µ` series converges fast — Table 6.1 uses `µ = 8192`), looks correct but
fails the accuracy target at the boundary. Reaching `1e-10` at `µ = 135`
needs roughly 50 coefficients (columns `j = 0..9`, `k = 0..4`); the paper's
authors generated those with a computer-algebra system but did not publish
them.

## Fix

An offline generator, `scripts/marcum-fjk-generate.py`, re-derives §4.6.2 in
exact rational / 120-digit arithmetic (SymPy + mpmath: build `φ(z)`, form
`σ² = 2(φ(z)−φ(z₀))`, revert the series, extract `f_{jk}`). It is **triple-gated**
before its output is trusted:

- **Gate A** — symbolically reproduces every printed Eq. 90 coefficient
  (`worst err ~1e-115`).
- **Gate B** — confirms the identity `f_{0,k} = u_k(u²)`: the `j=0` column is
  exactly the standard Bessel uniform-asymptotic coefficient sequence
  (`worst err ~1e-111`).
- **Gate C** — assembles the full Q/P expansion and compares against
  `scipy.stats.ncx2` across a grid spanning the `µ ≥ 135` band, and from that
  *empirically* selects the truncation (`J=9, K=4`) so the worst-case relative
  error at `µ = 135` is `≤ 1×10⁻¹¹` (achieved `1.6×10⁻¹²`).

The float64 output is hardcoded into `src/special/marcum-q.js` as a
machine-generated `const` block, delimited by `BEGIN/END GENERATED
COEFFICIENTS` markers that `scripts/marcum-fjk-generate.py` splices into — the
same inline hardcoded-table pattern as `gamma.js`, `owen-t.js`, `log-gamma.js`
(none of which use a standalone module). A hardcoded table was chosen over a
runtime power-series derivation because float64 series-reversion at truncation
order ~10 has a condition-number problem; exact offline derivation sidesteps
it. `_largeMu` evaluates the expansion (erfc-seeded `Ψ_j` recurrence, Horner
`A_j` assembly), computes the smaller of P/Q directly (Eq. 75 / Eq. 80) and
the larger as `1 − primary`, and `_besselT` supplies the modified-Bessel
correction `T` via the uniform Bessel asymptotic. The dispatcher splits the
band: `µ ≥ 135 → _largeMu`, `µ < 135 → _recurrence`.

Secondary: ESLint's `no-loss-of-precision` false-positives on some canonical
16-digit float64 literals in the generated block (its `toPrecision()` heuristic
rounds the opposite way to the shortest round-trip repr). A scoped
`/* eslint-disable no-loss-of-precision */ … /* eslint-enable */` pair around
the generated literals suppresses it; every literal was verified to round-trip
(`String(Number(s)) === s`).

## Prevention Strategy

- **When implementing a published asymptotic expansion, count the printed
  coefficients against the accuracy the routing boundary demands.** A paper's
  printed terms back its *stated* claim (here `O(µ⁻²)`), not necessarily a
  library's tighter target. Compute the truncation error at the *worst* routed
  point (smallest µ, band edge) before assuming the printed set suffices.
- **Treat coefficient generation as a first-class prerequisite with its own
  correctness gates**, not a side task. Re-derive in exact arithmetic; gate
  against (a) whatever the paper *does* print, (b) any independent identity the
  coefficients must satisfy, and (c) a reference implementation across a grid
  spanning the routing boundary. Let the reference comparison *pick* the
  truncation rather than guessing it.
- A dispatcher whose branches each hold only on a sub-domain must validate
  each branch at its boundary, where its method is weakest.

## Related Solutions

- `solutions/special-functions/2026-05-21-0724-marcum-q-four-branches.md` (#253)
  — implemented the other four Marcum branches and explicitly recorded §4.2 as
  the deferred deviation (the recurrence covering the whole band); this work
  closes that gap. It also established the `{p, q}` dispatcher and the
  compute-the-smaller-tail-directly rule that `_largeMu` upholds.
- `solutions/special-functions/2026-05-17-1540-erfc-crossover-cancellation.md`
  (#211) — same family of regime-crossover precision concerns.

## Key Insight

A paper printing only 10 of an asymptotic expansion's coefficients is not an
oversight — it is exactly enough for the paper's own `O(µ⁻²)` claim — but at a
practical routing boundary of `µ = 135` those 10 give `5×10⁻⁵` error, five
orders short of `1×10⁻¹⁰`; hitting the target needs ~50 coefficients that must
be re-derived offline in exact arithmetic and gated against a reference
implementation before being trusted.
