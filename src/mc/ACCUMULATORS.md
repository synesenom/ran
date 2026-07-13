# MCMC online accumulators — mechanism reference

This is the detailed explanation of the streaming accumulators in
[`_mcmc.js`](./_mcmc.js) — the math, the update recurrences, the derivations, and
the invariants — beyond what fits in inline comments. It is a companion to the
*decisions*:

- **ADR-0020** (`decisions/0020-mcmc-design.md`) — *why* online accumulators replaced the old rolling-history closures, and the `samplingRate`-tuning rationale.
- **ADR-0021** (`decisions/0021-mcmc-windowed-acceptance-rate.md`) — *why* `ar()` is a sliding window.
- **ADR-0022** (`decisions/0022-rwm-joint-adaptive-metropolis.md`) — the acceptance-accounting reconciliation and the removal of the old cumulative counters.

The ADRs record decisions; this file records **how the chosen accumulators actually work**.

---

## 1. Lifecycle: one update per iteration, reset at phase boundaries

`MCMC` keeps three families of accumulator, all per-instance, all reset together:

| Accumulator | Purpose | Consumed by |
| --- | --- | --- |
| Welford records `_welford` | running mean & variance per dimension | `statistics()`, and the variance normaliser in `ac()` |
| Autocorrelation ring buffers `_acBuf`/`_acCross` | running lagged cross-products per dimension | `ac()`, and through it `_thinningLag()` |
| Acceptance ring buffer `_arBuf`/`_arCount` | windowed accept/reject outcomes | `ar()` |

**Reset points** — `_initAccumulators()` runs in exactly two places:

1. the constructor, and
2. the start of `sample()`.

It runs **nowhere else**. In particular `warmUp()` does *not* reset between its
batches (see §5). Every accepted-or-rejected step feeds exactly one call to
`_updateAccumulators(x, accepted)`, where `x` is the state *after* the accept/reject
decision (the retained state on rejection, the proposal on acceptance) and
`accepted` is the boolean outcome.

---

## 2. Welford's algorithm — mean and variance

### State

One record per dimension: `{ n, mean, M2 }`, where `n` is the count, `mean` is the
running mean, and `M2` is the running sum of squared deviations from the *current*
mean, i.e. `M2 = Σ (xᵢ − mean_n)²`.

### Update recurrence

For a new scalar value `v` in dimension `d`:

```
n     ← n + 1
delta ← v − mean          // deviation from the OLD mean
mean  ← mean + delta / n
M2    ← M2 + delta · (v − mean)   // (v − NEW mean)
```

The two-mean product `delta · (v − mean)` — deviation from the old mean times
deviation from the new mean — is the crux of Welford's identity. It updates
`Σ(xᵢ − x̄)²` incrementally without ever forming `Σxᵢ²`, so it avoids the
catastrophic cancellation of the textbook `Σxᵢ²/n − x̄²` formula, which subtracts
two large nearly-equal quantities when the variance is small relative to the mean.

### Queries

- **`statistics()`** reports the **sample** variance `M2 / (n − 1)` (Bessel-corrected),
  `std = √variance`, and `cv = std / |mean|`. Guards: `n ≤ 1 → variance 0`;
  `mean === 0 → cv = NaN` (the coefficient of variation is undefined at a zero mean,
  per the return-value conventions in ADR-0015).
- **`ac()`** uses the **population** variance `M2 / n` as its normaliser (§3) —
  a deliberately different divisor from `statistics()`, chosen so the lag-0
  autocorrelation is exactly 1 (see the derivation below).

---

## 3. Autocorrelation — ring buffer + running cross-products

This is the subtle one. The goal is the autocorrelation function ρ(r) for lags
`r = 0 … maxLag−1`, updated online, without retaining the full history.

### State (per dimension)

- `_acBuf[d]` — a `Float64Array(maxLag)` **ring buffer** holding the most recent
  `maxLag` values of dimension `d`.
- `_acCross[d]` — a `Float64Array(maxLag)` of **running lagged cross-product sums**;
  `_acCross[d][r]` accumulates `Σ xᵢ·xᵢ₋ᵣ`.
- `_acN` — a single global observation counter (shared across dimensions; incremented
  once per `_updateAccumulators` call, after the per-dimension loop).

### Update recurrence

Let `n = _acN` be the 0-based global index of the value `v` being inserted (read
*before* the increment). For each dimension:

```
cross[0] += v · v
for r = 1 … min(n, maxLag − 1):
    cross[r] += v · buf[(n − r) mod maxLag]
buf[n mod maxLag] = v
```

(then, once per iteration, `_acN += 1`).

### Why `cross[r]` is correct

**Claim.** After `n` observations `x₀ … x_{n−1}` have been processed,
`cross[r] = Σ_{i=r}^{n−1} xᵢ·xᵢ₋ᵣ`, a sum of exactly `n − r` products.

**Proof.** When the value at global index `k` is inserted (so `_acN = k` at that
moment), the loop adds `x_k · buf[(k−r) mod maxLag]` to `cross[r]` for every
`r ∈ [1, min(k, maxLag−1)]`. At that instant `buf[(k−r) mod maxLag]` still holds
`x_{k−r}` (see the ring-buffer-safety argument below), so the increment is exactly
`x_k · x_{k−r}`. Summing the contributions across all insertions `k = r … n−1`
telescopes to `Σ_{k=r}^{n−1} x_k·x_{k−r}`. The `r = 0` line adds `x_k²` at every
step, giving `Σ x_k²`. ∎

### Why the ring buffer never reads a stale slot

At global step `k` we **read** `buf[(k−r) mod maxLag]` for `r ∈ [1, maxLag−1]` and
only afterwards **write** `buf[k mod maxLag]`. The slot `k mod maxLag` about to be
overwritten currently holds `x_{k−maxLag}` (or is unwritten for `k < maxLag`). The
indices we read are `k − r ∈ [k − maxLag + 1, k − 1]`, none of which equals
`k − maxLag`. So every read returns the intended `x_{k−r}`, and the value we are
about to evict is never one we still need. This is exactly why the inner loop caps
at `maxLag − 1`, and why `maxLag` bounds the largest resolvable lag.

### Query — `ac()`

For lag `r` in dimension `d`, with `n = _acN`, mean `μ` and population variance
`σ² = M2/n` from the Welford record:

```
ρ̂(r) = ( cross[r] / (n − r) − μ² ) / σ²          for r < n
ρ̂(r) = NaN                                        for r ≥ n
```

`r ≥ n` yields `NaN` because there are no pairs at that lag yet (a lag needs at
least `r + 1` observations). Callers must not read tail lags right after a reset.

**Lag 0 is exactly 1:** `cross[0]/n − μ² = Σx²/n − μ² = M2/n = σ²`, so
`ρ̂(0) = σ²/σ² = 1`. This is the reason `ac()` normalises by the *population*
variance `M2/n` rather than the sample variance `M2/(n−1)` — the numerator's
lag-0 term and the denominator then share the same divisor and cancel to 1.

**On the estimator.** `cross[r]/(n−r) − μ²` estimates the lag-`r` autocovariance
using the pair count `n − r` as the divisor, while the normaliser uses the divisor
`n`. The result is therefore ≈ `n/(n−r)` times the classic "biased" ACF estimator
(which uses divisor `n` in both). For the regime this runs in — `n` in the tens of
thousands during warm-up, `r ≤ maxLag = 100` — the `n/(n−r)` factor is within a
fraction of a percent of 1, so the distinction is immaterial. Unlike the pure
divisor-`n` estimator, this form is **not** guaranteed positive semidefinite, which
is acceptable here: `ac()` is a mixing diagnostic and a thinning input, not the
input to a spectral method that would require a valid autocovariance sequence.

### Complexity

`O(dim · maxLag)` memory; `O(dim · maxLag)` per `_updateAccumulators` call; each
individual lag value in `ac()` is `O(1)`, so a full `ac()` call is `O(dim · maxLag)`.
None of this grows with the number of iterations — the whole point of the rewrite
in ADR-0020.

---

## 4. Windowed acceptance rate — ring buffer + running count

### State

- `_arBuf` — a `Uint8Array(arWindow)` of the last `arWindow` accept(1)/reject(0)
  outcomes (default `arWindow = 1000`, configurable via `config.arWindow`).
- `_arCount` — the running number of 1s currently in `_arBuf`.
- `_arN` — the total outcomes recorded since the last reset.

### Update recurrence

```
cursor  = _arN mod arWindow
arValue = accepted ? 1 : 0
_arCount += arValue − _arBuf[cursor]     // add the newcomer, subtract the evicted
_arBuf[cursor] = arValue
_arN += 1
```

**Invariant.** After every update, `_arCount = Σ_j _arBuf[j]` = the number of
accepts among the last `min(_arN, arWindow)` iterations. The subtract-then-add step
maintains it in `O(1)` without rescanning the buffer: writing `cursor` overwrites
the oldest live entry once the window is full, and `_arCount` is corrected by
exactly the evicted value.

### Query — `ar()`

```
ar() = _arN > 0 ? _arCount / min(_arN, arWindow) : 0
```

- **Partial-fill phase** (`_arN < arWindow`): the buffer's untouched tail is still
  0, so `_arCount` is the cumulative accept count and the denominator is `_arN` —
  `ar()` equals the exact cumulative acceptance rate. Behaviour is byte-for-byte
  identical to a plain cumulative counter for any run shorter than `arWindow`.
- **Sliding phase** (`_arN ≥ arWindow`): `ar()` reflects only the last `arWindow`
  outcomes, so a read during a long `warmUp()` is not dragged down by the earliest,
  untuned batches (ADR-0021).

`O(arWindow)` memory (1 KB at the default), `O(1)` per update and per query.

---

## 5. Phase semantics — warm-up vs. sampling

`_updateAccumulators` runs on **every** iteration regardless of phase, but the two
phases treat the accumulators differently:

- **`warmUp()`** never resets between its batches. All three accumulators span the
  entire warm-up run, which is deliberately non-stationary: `_adjust()` is still
  retuning the proposal underneath them. This is why `samplingRate` is nudged by
  only ±1 per batch from `_thinningLag()` rather than jumping to the estimated lag —
  the autocorrelation estimate is taken over a moving target and a gradual step
  damps the resulting oscillation (ADR-0020 §3).
- **`sample()`** calls `_initAccumulators()` first, so `statistics()`, `ac()`, and
  `ar()` afterwards describe the **sampling phase only**, never blending
  adaptation-phase draws into equilibrium-phase summaries.

`_thinningLag()` consumes `ac()`: for each dimension it finds the first lag whose
`|ρ̂|` has decayed to ≤ 0.05 and takes the **maximum** across dimensions (the
slowest-mixing dimension bounds safe thinning). If a dimension never decorrelates
within `maxLag`, it falls back to the largest measured lag — **not** 0 — so a
badly-mixing chain raises `samplingRate` instead of collapsing it (the bug fixed
alongside ADR-0022; returning 0 there previously inverted the whole rule).

---

## 6. Why RWM keeps its own acceptance counter

`RWM` (`rwm.js`) maintains a **separate** `_pAccepted`/`_pN` batch counter for its
Robbins-Monro step-size tuner and does **not** read `ar()`. The two measure the same
raw signal (accept/reject outcomes) but with incompatible windows:

- the tuner needs the rate over the **last 100 proposals, in non-overlapping batches
  that reset each batch**, so its Robbins-Monro batch index advances on independent
  data;
- `ar()` reports a **1000-wide sliding** window for a smooth user-facing diagnostic.

Unifying them onto one buffer would couple the sampler's adaptation dynamics to the
user-configurable `arWindow` — the hazard ADR-0021 flagged. The base class's old
cumulative `_accepted`/`_totalIter` counters, once retained for a hypothetical
all-time diagnostic, were removed in ADR-0022: they were written every step and read
nowhere, and an all-time rate is a three-line re-add if it is ever actually needed.

---

## 7. Invariants and edge cases at a glance

| Property | Value / condition |
| --- | --- |
| Reset points | constructor and `sample()` start only |
| Update cadence | one `_updateAccumulators(x, accepted)` per iteration, both phases |
| `statistics()` variance divisor | `n − 1` (sample), `0` when `n ≤ 1` |
| `cv` when `mean === 0` | `NaN` |
| `ac()` normaliser divisor | `n` (population) — makes ρ̂(0) = 1 exactly |
| `ac()` at lag `r ≥ _acN` | `NaN` (too few pairs) |
| Largest resolvable lag | `maxLag − 1` (ring-buffer capacity) |
| `ar()` before any iteration | `0` |
| `ar()` partial fill (`_arN < arWindow`) | exact cumulative rate |
| Autocorrelation memory | `O(dim · maxLag)` |
| Acceptance memory | `O(arWindow)` |
| Per-iteration update cost | `O(dim · maxLag)` (dominated by the cross-product loop) |
