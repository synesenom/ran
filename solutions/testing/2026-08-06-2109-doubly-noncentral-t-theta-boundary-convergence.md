---
date: 2026-08-06T21:09:00Z
category: "testing"
problem: "Whether DoublyNoncentralT.fit()'s seed=7 theta=0 boundary convergence at large nu is a correct constrained optimum or an artifact of premature convergence/clamping near the theta >= 0 boundary"
status: complete
related_issue: "#1339"
tags: [doubly-noncentral-t, fit, powell, boundary-convergence, theta-nonnegativity, kkt, profile-likelihood]
---

# Solution: DoublyNoncentralT.fit() theta=0 boundary convergence at large nu

**Date**: 2026-08-06T21:09:00Z
**Category**: testing
**Related Issue**: #1339

## Problem

Issue #1336's profile-likelihood investigation (fixing `nu`, re-optimizing `mu`/`theta` to full Powell
precision for each candidate `nu`) found that for seed=7's calibration data
(`new dist.DoublyNoncentralT(5, 1, 2).seed(7).sample(300)`), the profile-optimal `theta` decreases
monotonically as `nu` increases and hits exactly the `theta >= 0` constraint boundary
(`src/dist/doubly-noncentral-t.js`'s `Distribution.validate(..., ['nu > 0', 'theta >= 0'])`) by
`nu=30`, staying there through `nu=50`. This was not separately investigated: whether `_fitInit` or
Powell's line search have any correctness issue specifically near a `theta` boundary (as opposed to an
interior optimum), and whether the pattern is specific to seed=7's realization.

## Findings

**1. The theta=0 corner is a genuine constrained optimum, not an artifact of premature
convergence or clamping.** Two independent checks confirm this for seed=7 at `nu=25/30/40/50`:

- A fine `theta` grid (`0, 0.001, 0.005, ..., 1.0`) with `mu` re-optimized to full Powell precision
  (`tol=1e-12, maxIter=200`) at each `theta` shows lnL decreasing *monotonically* as `theta` increases
  away from 0 — e.g. at `nu=30`: `theta=0 → lnL=-442.131560`, `theta=0.01 → -442.132444`,
  `theta=1.0 → -442.291363`. The KKT condition for a boundary optimum (the profile gradient points
  outward, i.e. `∂lnL/∂θ ≤ 0` at `θ=0`) is satisfied — increasing `theta` from 0 only ever makes the
  fit worse at these `nu` values. There is no interior point past the boundary the search is being
  denied.
- Running the 2-parameter (`mu`, `theta`) profile Powell search at `nu=30` from 7 different starting
  points (`theta0` ranging from `0.0001` to `5.0`, `mu0` from `0.5` to `1.5`) at full precision
  (`tol=1e-10, maxIter=200`) converges to `theta ≈ 1e-9`–`1e-8` (never negative) from *every* start,
  with bit-identical `lnL = -442.131560` to 6 decimal places across all of them. This is textbook
  reliable convergence, not a search that got stuck prematurely near the boundary — a premature/unstable
  convergence would show start-dependent stopping points or a spread of `lnL` values.
- `powell.js`'s Infinity-barrier handling was traced directly, and it does admit `Infinity` into
  `state.fw`/`fv` in practice: `_brentSlot`'s identity checks (`w === x`, `v === x`, `v === w`,
  `powell.js:69-74`) let an infeasible (`theta < 0`) trial's `Infinity` value into `fw` on the first
  iteration (when `w` still equals `x` from `brentMin`'s initialization) regardless of its magnitude,
  and a second infeasible trial can cascade that `Infinity` on into `fv`. With `fw`/`fv` at `Infinity`
  and `fx` finite, `_computeParabolicStep`'s `r = (x-w)*(fx-fv)` and `q = (x-v)*(fx-fw)` both evaluate
  to signed `Infinity`, and `p = (x-v)*q - (x-w)*r` can land on `Infinity - Infinity = NaN` depending
  on the sign structure. The algorithm is still boundary-safe, but the reason is a downstream guard,
  not the absence of `Infinity` from the tracked state: `brentMin`'s step-size check
  (`Math.abs(state.d) >= tol1`, `powell.js:198`) is `false` for `d = NaN` (`Math.abs(NaN)` is never
  `>= tol1`), so it falls through to `state.x + sign(tol1, state.d)`, and `sign`'s own `b >= 0` test
  (`powell.js:20-22`) is likewise `false` for `NaN`, producing a valid finite trial point
  `u = x - tol1` instead of a `NaN` one. `lineMin`'s uphill-step guard (`if (!(fret < f0))`,
  `powell.js:214`) is a second backstop, catching any `NaN` `fret` that reached the return value
  (`NaN < f0` is `false`, so the search stays at the last good point). This is a correctly-designed
  boundary-tolerant algorithm, confirming the empirical multi-start result rather than contradicting
  it — but the mechanism is these two fallback guards, not an absence of `Infinity` in the tracked
  bracket.

**2. The pattern is not specific to seed=7.** Re-running the same `nu`-sweep for all four of #1336's
calibration seeds up to `nu=50`:

| seed | theta=0 reached by | profile shape |
|---|---|---|
| 1 | not reached (theta rises 3.72→7.50 through nu=50) | monotonically widening, no boundary contact |
| 7 | nu≈25 | near-flat ridge from nu=9-50 (per #1336), *then* boundary |
| 42 | not reached (theta falls 2.68→1.60 through nu=50, still positive) | narrowing but interior throughout tested range |
| 99 | nu≈25 | steeply, monotonically worsening (lnL drops ~14 units from nu=5 to nu=50) — **not** a flat ridge |

Two of the four seeds (7 and 99) hit the boundary within the tested range; the other two do not (they
may at higher `nu`, untested since it is not relevant to `.fit()`'s actual behavior — see finding 3).
Seed 99's fine `theta` grid at `nu=25` was checked the same way as seed 7's and shows the same
monotonic-falloff KKT signature (`theta=0 → lnL=-450.445163`, `theta=0.5 → -450.512742`) — a genuine
boundary optimum, not an artifact. Critically, seed 99 hitting the boundary is *independent* of
#1336's "flat ridge" characterization of seed 7: #1336 described seed 99 as "sharply peaked... with no
ridge at all", and that remains true — seed 99's profile likelihood is steeply monotonic decreasing
even before `nu` reaches the boundary region, unlike seed 7's near-flat plateau. "Hits the theta=0
boundary" and "has a flat ridge" are two independent properties of a profile, exactly as #1336 found
the ridge and the bounded-vs-unbounded gap size to be independent of each other.

**3. `.fit()`'s actual 3-parameter joint search never approaches the boundary region on this data
class, for either seed.** The theta=0 corner only appears when `nu` is artificially fixed to a large
value by the *investigative* profile-sweep methodology (#1336's device for characterizing the
likelihood surface one `nu` slice at a time) — it is never something the production, unconstrained
3-parameter `.fit()` search encounters, because the boundary region is a strictly worse local optimum
than the interior one `.fit()` actually finds:

- Seed 7: `_fitInit` seeds `[nu=18, mu=1.079, theta=1]`. Both the bounded (`tol=1e-2, maxIter=15`) and
  unbounded (`tol=1e-10, maxIter=200`) `.fit()` searches converge to `nu=16`/`nu=17` respectively, with
  `theta=0.876`/`0.721` — comfortably interior, nowhere near the `nu≥25` boundary region. Their
  measured gap (`0.00472`) matches #1336's reported `0.0047` for this seed exactly, confirming this
  reproduction is consistent with #1336's own measurement.
- Seed 99: `_fitInit` seeds `[nu=10, mu=1.067, theta=1]`. Bounded/unbounded `.fit()` converge to
  `nu=6`/`nu=5` with `theta=1.808`/`2.254` — again far from the `nu≥25` boundary. Gap measured
  `0.6094`, matching #1336's reported `0.609`.

Both bounded and unbounded searches behave *consistently* with each other in the sense that matters:
neither one wanders toward the inferior boundary region, and the gap between them reproduces #1336's
own numbers bit-for-bit in the sense that matters (three significant figures), with no sign of
boundary-specific instability.

**4. The only convergence degradation observed near the boundary is not boundary-specific.** Starting
the bounded-budget (`tol=1e-2, maxIter=15`) 2-parameter profile search from a `theta0` far from the
true optimum (e.g. `theta0=10`) under-converges at both an interior optimum (`nu=20`, true
`theta*=0.431`: bounded search stops at `theta=1.461`, `lnL` off by `~0.46`) and the boundary
(`nu=30`, true `theta*≈0`: bounded search stops at `theta=0.585`, `lnL` off by `~0.27`) by comparable
magnitudes. This is the already-tracked, already-filed #1338 fractional-convergence-tolerance-vs-`n`
mechanism (`solutions/testing/2026-08-05-1736-powell-fractional-convergence-n-scaling.md`), not
something specific to sitting on a parameter boundary. Since `.fit()`'s actual `_fitInit` seed
(`theta=1`, a moderate start, not the artificially far `theta0=10` used only to probe this) never lands
the joint search anywhere near the boundary region in the first place (finding 3), this degradation
mode is not reachable through the production `.fit()` code path for this data class regardless.

## Outcome

This was a documentation-only investigation — no production code changed, matching the issue's
explicit "Out of Scope: Implementing any fix" and #1336's own precedent. All four acceptance criteria
are answered:

- The theta=0 corner solution is a **correct reflection of the true constrained profile likelihood**
  (KKT-satisfying boundary optimum), not an artifact of premature convergence or clamping.
- The pattern is **not specific to seed=7** — seed 99 shows the same boundary contact (via an
  independent, steeper mechanism), while seeds 1 and 42 do not within the tested `nu` range.
- `.fit()`'s actual joint 3-parameter search **behaves consistently** whether or not the profile's
  boundary exists, because it never approaches that region on well-matched data — it correctly settles
  on the true (interior) optimum, reproducing #1336's own bounded-vs-unbounded gap measurements exactly.
- **No genuine optimizer correctness issue was found.** `powell.js`'s Infinity-barrier design was traced
  and confirmed NaN-safe and boundary-tolerant; the one convergence-quality effect observed near the
  boundary is the already-filed #1338 mechanism, general to any optimum (interior or boundary) reached
  from a sufficiently far starting point under the bounded search budget.

No follow-up issue was filed, per acceptance criterion 4's own conditional ("if a genuine optimizer
correctness issue is found") — none was.

`test/dist-base-fit-3.js`'s `DoublyNoncentralT.fit should not show intolerable quality loss...` test
comment (already referencing #1339 as a named follow-up per #1336's resolution) was extended with this
issue's conclusion, so a future reader does not need to chase the open issue to learn the boundary
convergence was checked and found correct.

## Prevention Strategy

When a profile-likelihood sweep (an investigative device that fixes one parameter and re-optimizes the
rest) runs a constrained parameter into its boundary, check the KKT condition directly (does the
objective monotonically worsen moving away from the boundary?) rather than assuming boundary contact
signals an optimizer weakness. Separately, confirm the *production* code path (here, `.fit()`'s
unconstrained joint search) actually reaches the region under scrutiny before spending further
investigation budget on it — an artifact of the investigative methodology (forcing a parameter to a
value the real optimizer would never choose) is not evidence of a production bug.

## Related Solutions

- `solutions/testing/2026-08-04-1631-doubly-noncentral-t-fit-convergence-ridge.md` — #1336's own
  investigation, which characterized the (nu, theta) ridge, found the bounded-vs-unbounded gap's real
  driver (a fractional-tolerance/`n`-scaling interaction, not the ridge), and filed this issue (#1339)
  and #1338 as follow-ups.
- `solutions/testing/2026-08-05-1736-powell-fractional-convergence-n-scaling.md` — #1338's own
  follow-up, the source of the fractional-tolerance mechanism finding 4 above reuses.

## Key Insight

A parameter pinned at its constraint boundary during a profile-likelihood sweep is not, by itself,
evidence of a search or clamping bug — check whether the objective actually worsens moving off the
boundary (the KKT signature of a genuine constrained optimum) before suspecting the optimizer. And
before investigating boundary-specific behavior further, confirm the *unconstrained* production search
path ever visits that region at all: an artificial device used only to characterize a likelihood
surface one slice at a time can produce boundary contact the real, jointly-optimizing search would
never encounter.
