# ADR-0023: MCMC Online Accumulator Mechanics and Invariants

**Date**: 2026-07-13
**Status**: Accepted

## Context

ADR-0020 decided to replace the old rolling-history closures with three online
accumulators, and ADR-0021 made the acceptance accumulator a sliding window. Those
ADRs record *why* the accumulators exist and were chosen; neither pins down *how*
they work in enough detail to review a change against. The exact update recurrences,
the estimator choices (which variance divisor, the `n − r` lag divisor, the
population-vs-sample split between `statistics()` and `ac()`), and the safety
invariants (the ring-buffer read-before-overwrite ordering, the two reset points,
the `NaN` conditions) live only in code and one-line inline comments.

These details are load-bearing and easy to get subtly wrong, as recent work showed:

- `_thinningLag()` returning `0` instead of the largest measured lag when a chain
  never decorrelated **inverted** the thinning rule (fixed alongside ADR-0022).
- Making `RWM`'s proposal joint changed which accumulator feeds its tuner and
  invalidated ADR-0021's granularity rationale for keeping that tuner separate.
- The base class's cumulative `_accepted`/`_totalIter` counters were written every
  iteration and read nowhere, and were removed in ADR-0022.

Each of these is the kind of error that produces a *plausible finite number*, not a
crash or a failing test — a wrong divisor, a stale ring slot, or a reset at the
wrong boundary shifts a statistic by a few percent and passes every existing
assertion. A future accumulator change, or a new sampler family (Gibbs/HMC/NUTS,
issues #824–826), can silently break an invariant with nothing to catch it. There
was no single normative reference to review such changes against.

## Decision

The accumulator mechanics and invariants below are **contractual** for `MCMC` and
every subclass. Changing any of them — a divisor, the reset cadence, the ring-buffer
bound, a `NaN` condition — is significant enough to require a **superseding ADR**,
not a silent code edit. `_initAccumulators()` carries an inline pointer to this ADR
so a change to the accumulators touches both. This is deliberate friction for
numerics whose errors do not surface as test failures.

### Lifecycle: one update per iteration, reset at phase boundaries

Three accumulator families, all per-instance, all reset together by
`_initAccumulators()`:

| Accumulator | Purpose | Consumed by |
| --- | --- | --- |
| Welford records `_welford` | running mean & variance per dimension | `statistics()`; the variance normaliser in `ac()` |
| Autocorrelation ring buffers `_acBuf`/`_acCross` | running lagged cross-products per dimension | `ac()`, and through it `_thinningLag()` |
| Acceptance ring buffer `_arBuf`/`_arCount` | windowed accept/reject outcomes | `ar()` |

`_initAccumulators()` runs in exactly two places — the constructor and the start of
`sample()` — and **nowhere else**. `warmUp()` does not reset between batches (see
"Phase semantics"). Every step feeds exactly one `_updateAccumulators(x, accepted)`,
where `x` is the state *after* the accept/reject decision (retained state on
rejection, proposal on acceptance) and `accepted` is the outcome.

### Welford's algorithm — mean and variance

State per dimension: `{ n, mean, M2 }`, with `M2 = Σ (xᵢ − mean_n)²`. Update for a
new scalar `v`:

```
n     ← n + 1
delta ← v − mean                 // deviation from the OLD mean
mean  ← mean + delta / n
M2    ← M2 + delta · (v − mean)   // delta × deviation from the NEW mean
```

The two-mean product `delta · (v − mean_new)` is Welford's identity; it updates
`Σ(xᵢ − x̄)²` without ever forming `Σxᵢ²`, avoiding the catastrophic cancellation of
`Σxᵢ²/n − x̄²` when the variance is small relative to the mean.

Queries:
- **`statistics()`** — **sample** variance `M2/(n − 1)` (`0` when `n ≤ 1`),
  `std = √variance`, `cv = std/|mean|` (`NaN` when `mean === 0`, per ADR-0015).
- **`ac()`** — **population** variance `M2/n` as its normaliser. The different
  divisor is deliberate: it makes lag-0 autocorrelation exactly 1 (below).

### Autocorrelation — ring buffer + running cross-products

State per dimension: `_acBuf[d]` = `Float64Array(maxLag)` ring buffer of the most
recent `maxLag` values; `_acCross[d]` = `Float64Array(maxLag)` of running sums with
`_acCross[d][r] = Σ xᵢ·xᵢ₋ᵣ`; plus one global counter `_acN` (incremented once per
`_updateAccumulators` call, after the per-dimension loop).

Update, with `n = _acN` the 0-based global index of the value `v` (read *before*
increment):

```
cross[0] += v · v
for r = 1 … min(n, maxLag − 1):
    cross[r] += v · buf[(n − r) mod maxLag]
buf[n mod maxLag] = v
```

**Correctness of `cross[r]`.** *Claim:* after `n` observations, `cross[r] =
Σ_{i=r}^{n−1} xᵢ·xᵢ₋ᵣ`, a sum of `n − r` products. *Proof:* when the value at global
index `k` is inserted (`_acN = k` then), the loop adds `x_k · buf[(k−r) mod maxLag]`
for each `r ∈ [1, min(k, maxLag−1)]`; at that instant that slot still holds `x_{k−r}`
(ring-buffer safety below), so the increment is exactly `x_k·x_{k−r}`. Summing over
insertions `k = r … n−1` gives `Σ x_k·x_{k−r}`; the `r = 0` line accumulates `Σx_k²`. ∎

**Ring-buffer safety.** At step `k` the code **reads** `buf[(k−r) mod maxLag]` for
`r ∈ [1, maxLag−1]` and only then **writes** `buf[k mod maxLag]`. The slot about to
be overwritten holds `x_{k−maxLag}` (or is unwritten for `k < maxLag`). The read
indices `k − r ∈ [k−maxLag+1, k−1]` never equal `k − maxLag`, so every read returns
the intended `x_{k−r}` and the evicted value is never one still needed. This is why
the inner loop caps at `maxLag − 1` and why `maxLag` is the largest resolvable lag.

**Query.** For lag `r`, with `n = _acN`, mean `μ`, population variance `σ² = M2/n`:

```
ρ̂(r) = ( cross[r]/(n − r) − μ² ) / σ²     for r < n
ρ̂(r) = NaN                                for r ≥ n   (a lag needs r+1 observations)
```

Lag 0 is exactly 1: `cross[0]/n − μ² = Σx²/n − μ² = M2/n = σ²`, so `ρ̂(0) = 1` — the
reason `ac()` normalises by the population variance `M2/n` rather than `M2/(n−1)`.

**Estimator note.** `cross[r]/(n−r) − μ²` uses the pair count `n − r` as its divisor
while the normaliser uses `n`, so `ρ̂(r)` is ≈ `n/(n−r)` times the classic
divisor-`n` "biased" ACF. For this regime — `n` in the tens of thousands during
warm-up, `r ≤ maxLag = 100` — the factor is within a fraction of a percent of 1.
Unlike the divisor-`n` estimator this form is not guaranteed positive semidefinite,
which is acceptable: `ac()` is a mixing diagnostic and thinning input, not the input
to a spectral method that needs a valid autocovariance sequence.

Complexity: `O(dim·maxLag)` memory; `O(dim·maxLag)` per update; each lag value in
`ac()` is `O(1)`, so a full `ac()` call is `O(dim·maxLag)`. None grows with the
iteration count.

### Windowed acceptance rate — ring buffer + running count

State: `_arBuf` = `Uint8Array(arWindow)` of the last `arWindow` accept(1)/reject(0)
outcomes (`arWindow` default 1000, via `config.arWindow`); `_arCount` = running count
of 1s in the buffer; `_arN` = total outcomes since reset. Update:

```
cursor  = _arN mod arWindow
arValue = accepted ? 1 : 0
_arCount += arValue − _arBuf[cursor]     // add newcomer, subtract evicted
_arBuf[cursor] = arValue
_arN += 1
```

**Invariant:** after every update, `_arCount = Σ_j _arBuf[j]` = accepts among the
last `min(_arN, arWindow)` iterations, maintained in `O(1)` without rescanning.
Query:

```
ar() = _arN > 0 ? _arCount / min(_arN, arWindow) : 0
```

- Partial fill (`_arN < arWindow`): the untouched tail is 0, so this is the exact
  cumulative rate — byte-for-byte identical to a plain counter for runs shorter than
  `arWindow`.
- Sliding (`_arN ≥ arWindow`): reflects only the last `arWindow` outcomes, so a read
  during a long `warmUp()` is not dragged down by the earliest untuned batches
  (ADR-0021).

`O(arWindow)` memory (1 KB default), `O(1)` per update and query.

### Phase semantics — warm-up vs. sampling

`_updateAccumulators` runs on every iteration in both phases. The phases differ only
in resets and in whether adaptation runs:

- **`warmUp()`** never resets between batches. All three accumulators span the whole
  warm-up run, which is deliberately non-stationary (`_adjust()` is retuning the
  proposal underneath them). This is why `_adjustSamplingRate()` nudges `samplingRate`
  by only ±1 per batch from `_thinningLag()` instead of jumping to the estimated lag
  — the estimate is over a moving target and a gradual step damps the oscillation
  (ADR-0020 §3).
- **`sample()`** resets first, so `statistics()`, `ac()`, and `ar()` afterwards
  describe the sampling phase only, never blending in adaptation-phase draws.

`_thinningLag()` reads `ac()`: per dimension it takes the first lag whose `|ρ̂| ≤ 0.05`
and returns the **maximum** across dimensions (the slowest-mixing dimension bounds
safe thinning). A dimension that never decorrelates within `maxLag` falls back to the
largest measured lag — **not** 0 — so a badly-mixing chain raises `samplingRate`
instead of collapsing it (returning 0 there inverted the rule; fixed alongside
ADR-0022).

### Why RWM keeps its own acceptance counter

`RWM` maintains a separate `_pAccepted`/`_pN` batch counter for its Robbins-Monro
tuner and does not read `ar()`. Both measure accept/reject outcomes but with
incompatible windows: the tuner needs the rate over the **last 100 proposals in
non-overlapping batches that reset each batch** (so its batch index advances on
independent data), whereas `ar()` is a **1000-wide sliding** diagnostic. Unifying
them would couple the sampler's adaptation to the user-configurable `arWindow` — the
hazard ADR-0021 flagged. Rationale and the removal of the old cumulative counters are
in ADR-0022.

### Invariants at a glance

| Property | Value / condition |
| --- | --- |
| Reset points | constructor and `sample()` start only |
| Update cadence | one `_updateAccumulators(x, accepted)` per iteration, both phases |
| `statistics()` variance divisor | `n − 1` (sample); `0` when `n ≤ 1` |
| `cv` when `mean === 0` | `NaN` |
| `ac()` normaliser divisor | `n` (population) — makes ρ̂(0) = 1 exactly |
| `ac()` at lag `r ≥ _acN` | `NaN` |
| Largest resolvable lag | `maxLag − 1` |
| `ar()` before any iteration | `0` |
| `ar()` partial fill | exact cumulative rate |
| Autocorrelation / acceptance memory | `O(dim·maxLag)` / `O(arWindow)` |
| Per-iteration update cost | `O(dim·maxLag)` (cross-product loop dominates) |

## Consequences

**Easier:**
- A single normative source to review accumulator diffs and new samplers against —
  the derivations and invariants no longer live only in one contributor's head.
- New sampler authors (Gibbs/HMC/NUTS) know exactly which invariants the base-class
  accumulators guarantee and which they must preserve.

**Harder:**
- The mechanics are pinned: changing a divisor, the reset cadence, or the ring-buffer
  bound now requires a superseding ADR, not just a code edit. This is the intended
  friction for numerics whose errors pass tests.
- This ADR must not drift from the code. The `_initAccumulators()` pointer keeps a
  change visible in both places, but the sync is a manual invariant, like the
  `_internal()`/constructor key contract noted in ADR-0020.
