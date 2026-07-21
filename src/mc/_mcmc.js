import Xoshiro128p from '../core/xoshiro'

/**
 * Base class implementing a general Markov chain Monte Carlo sampler. All MCMC samplers extend this class.
 * MCMC samplers approximate integrals by efficiently sampling a density that cannot be normalized or
 * sampled directly. Every public subclass (RWM, AdaptiveMetropolis, Slice, HMC, Gibbs, MALA, NUTS)
 * exposes an options-object-only constructor; this base constructor's positional
 * (logDensity, config, initialState) signature is an internal contract those subclasses forward to,
 * not part of the public API.
 *
 * @class MCMC
 * @memberof ran.mc
 * @param {Function} logDensity The logarithm of the (unnormalized) target density.
 * @param {Object=} config Sampler configuration. Supported properties:
 * <ul>
 *   <li>{dim}: Dimension of the state space. Default is 1.</li>
 *   <li>{maxLag}: Maximum lag stored for autocorrelation estimation. Default is 100.</li>
 *   <li>{arWindow}: Number of most recent iterations ar() averages over. Default is 1000.</li>
 * </ul>
 * @param {Object=} initialState Initial state of the sampler. Supported properties: {x} (starting
 * position), {samplingRate} (thinning interval), and {internal} for subclass-specific state.
 * @constructor
 * @throws {Error} If config.dim is provided but is not a positive integer, or exceeds the maximum allowed dimension.
 * @throws {Error} If config.maxLag is provided but is not a positive integer, or exceeds the maximum allowed lag.
 * @throws {Error} If config.arWindow is provided but is not a positive integer, or exceeds the maximum allowed window.
 * @throws {Error} If the combined dim*maxLag accumulator footprint exceeds the maximum allowed memory budget.
 */
// decisions/0020-mcmc-design.md — accumulator design and the _iter/_adjust/_internal subclass contract
// decisions/0030-mcmc-options-object-constructor.md — every public subclass's constructor is options-object-only
export default class MCMC {
  constructor (logDensity, config = {}, initialState = {}) {
    if (new.target === MCMC) {
      throw Error('MCMC is abstract and cannot be instantiated directly.')
    }
    MCMC._validateDim(config.dim)
    MCMC._validateMaxLag(config.maxLag)
    MCMC._validateArWindow(config.arWindow)
    const resolved = MCMC._resolveConfig(config)
    this.dim = resolved.dim
    this.maxLag = resolved.maxLag
    this._arWindow = resolved.arWindow
    MCMC._validateCombinedFootprint(this.dim, this.maxLag)
    this.lnp = logDensity
    this.r = new Xoshiro128p()
    // decisions/0035-mcmc-exact-stream-reproducible-resume.md — restoring the PRNG stream
    // position (not just x) before x is drawn is what makes an unprovided x redraw from the
    // resumed stream rather than a fresh one, matching Distribution.load()'s prngState precedent.
    MCMC._validatePrngState(initialState.prng, 'MCMC')
    if (initialState.prng) {
      this.r.load(initialState.prng)
    }
    // Tracked so seed() can tell whether it should re-draw x — otherwise a random
    // (unseeded) starting position chosen before seed() runs would make replay non-deterministic.
    // Must agree with the this.x assignment below (both keyed on presence, not truthiness),
    // or a falsy-but-explicit x (e.g. { x: null }) would report _xProvided while silently
    // drawing a random position anyway, leaving seed() unable to make it reproducible.
    this._xProvided = Object.prototype.hasOwnProperty.call(initialState, 'x')
    this.x = this._xProvided ? initialState.x : Array.from({ length: this.dim }, () => this.r.next())
    this.samplingRate = initialState.samplingRate || 1
    this.internal = initialState.internal || {}
    this._initAccumulators()
  }

  /**
   * Sets the seed for the sampler's pseudo random number generator. If the initial position
   * was not explicitly provided at construction, it is redrawn from the newly seeded generator
   * so that sampling is fully reproducible.
   *
   * @method seed
   * @memberof ran.mc.MCMC
   * @param {number|string} value The value of the seed, either a number or a string (for the ease of tracking seeds).
   * @returns {this} Reference to the current sampler.
   */
  seed (value) {
    this.r.seed(value)
    if (!this._xProvided) {
      this.x = Array.from({ length: this.dim }, () => this.r.next())
    }
    return this
  }

  /**
   * Returns the current state of the sampler. The return value can be passed to a sampler of the
   * same type to resume from this position.
   *
   * @method state
   * @memberof ran.mc.MCMC
   * @returns {Object} Object with properties: x (current position), samplingRate (thinning
   * interval), internal (subclass state), and prng (the PRNG's exact stream position, restored
   * on reconstruction so a resumed sampler's subsequent draws are bit-for-bit identical to an
   * uninterrupted run — decisions/0035-mcmc-exact-stream-reproducible-resume.md).
   */
  state () {
    return {
      x: this.x,
      samplingRate: this.samplingRate,
      internal: this._internal(), // key must match what constructor reads; see solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md
      prng: this.r.save()
    }
  }

  /**
   * Computes mean, standard deviation, and coefficient of variation for each dimension based on
   * observations seen since the last reset (start of sampling or construction).
   *
   * @method statistics
   * @memberof ran.mc.MCMC
   * @returns {Object[]} Array of {mean, std, cv} objects, one per dimension.
   */
  statistics () {
    return this._welford.map(w => {
      const variance = w.n > 1 ? w.M2 / (w.n - 1) : 0
      const std = Math.sqrt(variance)
      return { mean: w.mean, std, cv: w.mean !== 0 ? std / Math.abs(w.mean) : NaN }
    })
  }

  /**
   * Computes the acceptance rate over the most recent arWindow iterations (a sliding window,
   * default 1000). During the partial-fill phase, before arWindow iterations have occurred since
   * the last reset, this equals the exact cumulative rate.
   *
   * @method ar
   * @memberof ran.mc.MCMC
   * @returns {number} Fraction of proposals accepted in the current window.
   */
  // decisions/0021-mcmc-windowed-acceptance-rate.md — sliding window over the last arWindow draws
  // so mid-warmUp() reads aren't dragged down by early untuned batches.
  ar () {
    return this._arN > 0 ? this._arCount / Math.min(this._arN, this._arWindow) : 0
  }

  /**
   * Computes the autocorrelation function for each dimension at lags 0 to maxLag-1. Uses an
   * online estimator: O(dim * maxLag) memory, O(dim * maxLag) per update, O(1) per query.
   *
   * @method ac
   * @memberof ran.mc.MCMC
   * @returns {number[][]} Array of autocorrelation-vs-lag arrays, one per dimension. Lags with
   * fewer than r+1 observations return NaN.
   */
  ac () {
    const n = this._acN
    return this._acCross.map((cross, d) => {
      const w = this._welford[d]
      // Population variance for normalization — conventional for autocorrelation estimation
      const variance = w.n > 0 ? w.M2 / w.n : 1
      return Array.from({ length: this.maxLag }, (_, r) => {
        if (r >= n) return NaN
        return (cross[r] / (n - r) - w.mean * w.mean) / variance
      })
    })
  }

  /**
   * Computes the effective sample size for each dimension using Geyer's initial positive
   * monotone sequence estimator (IPSM; Geyer 1992, Vehtari et al. 2021 — the estimator used by
   * Stan and ArviZ): $\Gamma_m = \rho_{2m} + \rho_{2m+1}$ pairs consecutive lags starting at lag
   * 0 (so the first pair always includes $\rho_0 = 1$), clamped to be no larger than
   * $\Gamma_{m-1}$ (the true autocovariance sequence is convex, so a non-increasing sequence of
   * pair sums has strictly lower variance than summing raw lags). The sum stops at the first pair
   * whose clamped value is not positive;
   * $$\mathrm{ESS} = \frac{N}{-1 + 2 \sum_m \Gamma_m},$$
   * or $\mathrm{ESS} = N$ ($\tau = 1$) if even the first pair is non-positive (sum = 0) -- that
   * $-1 + 2 \cdot 0 = -1$ would otherwise give a nonsensical negative $\tau$. Anchoring the
   * pairing at lag 0 means $\rho_1$ alone can never prematurely truncate the sum:
   * $\Gamma_0 = 1 + \rho_1$ is non-positive only when $\rho_1 \le -1$, an extreme case, unlike the
   * old single-lag rule which underestimated $\tau$ (overestimated ESS) whenever an otherwise
   * well-mixing chain had one merely-negative early lag. Built directly on the same accumulators
   * as ac() and statistics() — no additional accumulator state. If the first pair itself is
   * already non-positive ($\rho_1 \le -1$, an extreme case), $\mathrm{ESS} = N$ exactly: a
   * legitimate output of this truncation rule when the sampler genuinely produces that strong an
   * anti-correlation, not necessarily a sign of a broken sampler. A milder resonance -- e.g. HMC's
   * fixed pathLength resonating with the target's geometry, see hmc.js -- typically lands well
   * short of that $\rho_1 \le -1$ boundary and instead inflates or deflates ESS relative to the
   * raw sample count without saturating to $N$ exactly. See #974: verified against a brute-force
   * autocorrelation over the raw iterate() sequence, which confirmed the online accumulator is
   * exact and the anti-correlation is genuine.
   *
   * A fully stuck (zero-variance) chain is a distinct case from the above: ac()'s divisor is the
   * population variance, so a chain that never moves produces $0/0 = \mathrm{NaN}$ at every lag
   * including lag 0. That NaN is not a signal of non-positive autocorrelation to saturate on — it
   * means the chain contributed zero effectively-independent samples, so ess() reports 1 rather
   * than $N$ (the $n = 0$ case, no observations at all yet, is unaffected and still reports 0).
   *
   * solutions/testing/2026-07-18-1641-ess-geyer-ipsm-pairing-offset-self-consistent-wrong-tests.md
   * — the pairing must start at lag 0 (anchored by rho[0] = 1), not lag 1; an off-by-one-lag
   * version of this method passed every hand-derived test because the tests were derived by hand
   * using the same wrong pairing.
   *
   * @method ess
   * @memberof ran.mc.MCMC
   * @returns {number[]} Array of effective sample sizes, one per dimension.
   */
  ess () {
    const n = this._acN
    return this.ac().map(rho => {
      // rho[0] is NaN only when the population variance is 0 (0/0) or n === 0 (ac()'s r >= n
      // rule) -- distinguish the two since only the former is the degenerate-chain case.
      if (isNaN(rho[0])) return n === 0 ? 0 : 1
      let sum = 0
      let prevGamma = Infinity
      for (let k = 0; k + 1 < rho.length; k += 2) {
        let gamma = rho[k] + rho[k + 1]
        // NaN (insufficient observations for this pair) also stops the sum, same as a
        // non-positive pair: neither contributes a valid positive-part term.
        gamma = Math.min(gamma, prevGamma)
        if (!(gamma > 0)) break
        sum += gamma
        prevGamma = gamma
      }
      // sum === 0 means even the first pair (which always includes rho[0] = 1) was non-positive;
      // -1 + 2*0 = -1 would give a nonsensical negative tau, so saturate to N (tau = 1) instead.
      return n / (sum === 0 ? 1 : -1 + 2 * sum)
    })
  }

  /**
   * Performs a single iteration, updates accumulators, and optionally calls a callback.
   *
   * Advanced/low-level: most callers should use [warmUp]{@link ran.mc.MCMC#warmUp} and
   * [sample]{@link ran.mc.MCMC#sample} instead, which drive `iterate()` internally. Calling it manually is
   * for cases that need per-step control (e.g. live progress plotting, custom stopping rules).
   * `sample()` resets the accumulators before it starts collecting, but interleaving manual
   * `iterate()` calls with `warmUp()`/`sample()` otherwise does not — mixing manual draws in can
   * blend adaptation-phase and equilibrium-phase observations into `statistics()`, `ar()`, and `ac()`.
   *
   * @method iterate
   * @memberof ran.mc.MCMC
   * @param {Function=} callback Called with (x, accepted) after each iteration.
   * @param {boolean=} warmUp Whether the iteration is part of warm-up. Default is false.
   * @returns {{x: number[], accepted: boolean, alpha?: number}} Result of the iteration. `alpha`
   * is optional and subclass-defined (see decisions/0025-hmc-iter-alpha-field.md).
   */
  iterate (callback = null, warmUp = false) {
    const i = this._iter(this.x, warmUp)
    this._updateAccumulators(i.x, i.accepted)
    this.x = i.x
    callback && callback(i.x, i.accepted)
    return i
  }

  /**
   * Carries out the warm-up phase. Runs batches of 10K iterations, adapts internal parameters
   * via _adjust(), and tunes the thinning interval using the online autocorrelation estimate.
   *
   * decisions/0024-mcmc-warmup-convergence-strategy.md — deliberately fixed-length, no convergence-triggered
   * early stop: no signal computable from a single chain can distinguish "converged" from "stuck". Gate
   * convergence on gelmanRubin() across multiple independently-seeded chains instead.
   *
   * @method warmUp
   * @memberof ran.mc.MCMC
   * @param {Function=} progress Called with the percentage complete (0–100) after each batch.
   * @param {number=} maxBatches Number of warm-up batches. Default is 100.
   */
  warmUp (progress, maxBatches = 100) {
    for (let batch = 0; batch < maxBatches; batch++) {
      for (let j = 0; j < 1e4; j++) {
        this._adjust(this.iterate(null, true))
      }
      this._adjustSamplingRate(this._thinningLag())
      // Report after each completed batch so the final call is exactly 100%; the old
      // batch <= maxBatches / 100*batch bound ran one extra batch and fired a redundant 0%.
      typeof progress === 'function' && progress(100 * (batch + 1) / maxBatches)
    }
  }

  /**
   * Samples from the target density. Resets accumulators so that statistics() reflects the
   * sampling phase only, and ar() reflects at most its last arWindow draws (see ADR-0021). Thins
   * the chain by samplingRate (set during warm-up).
   *
   * @method sample
   * @memberof ran.mc.MCMC
   * @param {Function=} progress Called with the integer percentage complete (0–99), once per percent.
   * @param {number=} size Number of samples to collect. Default is 1000.
   * @returns {number[][]} Array of sampled states.
   */
  sample (progress, size = 1000) {
    // Reset so warm-up's adaptation-phase draws don't blend into sampling-phase statistics — decisions/0020-mcmc-design.md
    this._initAccumulators()
    const iMax = this.samplingRate * size
    const samples = []
    // Integer-percent reporting: i % (iMax/100) mis-fired when iMax was not a multiple of 100
    // (float modulus rarely hits 0), so track the last reported percent and emit each once.
    let lastPct = -1
    for (let i = 0; i < iMax; i++) {
      this.iterate()
      if (typeof progress === 'function') {
        const pct = Math.floor(100 * i / iMax)
        if (pct > lastPct) {
          lastPct = pct
          progress(pct)
        }
      }
      if (i % this.samplingRate === 0) {
        samples.push(this.x)
      }
    }
    return samples
  }

  /**
   * Returns the subclass's internal variables. Must be overridden.
   *
   * @method _internal
   * @memberof ran.mc.MCMC
   * @returns {Object} Object containing the internal variables.
   * @protected
   * @ignore
   */
  _internal () {
    throw Error('MCMC._internal() is not implemented')
  }

  /**
   * Reseeds a subclass-owned proposal/momentum generator (`this._q`) and recomputes a
   * subclass-owned cached log-density (`this.lastLnp`) against the current `this.x`. Explicitly
   * called by a subclass's own `seed()` override — never invoked automatically by base-class
   * control flow — so subclasses without a `_q`/`lastLnp` pair (e.g. Gibbs, Slice) are
   * unaffected.
   *
   * @method _reseedCachedLogDensity
   * @memberof ran.mc.MCMC
   * @param {number|string} value The seed value passed to the sampler's `seed()` method.
   * @protected
   * @ignore
   */
  // decisions/0027-mcmc-reseed-cached-log-density-hook.md — extracted reseed-and-recompute logic
  // shared by RWM, AdaptiveMetropolis, and HMC into one explicitly-called protected method
  _reseedCachedLogDensity (value) {
    // Derive _q's seed from `value` rather than reusing it verbatim: Xoshiro128p.seed() is a pure
    // function of its argument with no per-instance salt (src/core/xoshiro.js), so seeding the
    // proposal/momentum generator and this.r with the identical value aliases them into one shared
    // stream — the Metropolis accept/reject uniform would then be a value already consumed to build
    // an earlier proposal, breaking the independence the MH ratio assumes. The `${value}-q` suffix
    // mirrors ParallelTempering's per-replica `${value}-${i}` seeding.
    this._q.seed(`${value}-q`)
    this.lastLnp = this.lnp(this.x)
  }

  /**
   * Restores Robbins-Monro dual-averaging state (Hoffman & Gelman 2014 S3.2) shared by HMC and
   * NUTS: `_daMu` the shrinkage target, `_daHbar` the running acceptance-probability-deviation
   * statistic, `_daLogEpsBar` the smoothed log step size, `_daT` the iteration counter. Explicitly
   * called by each subclass's own constructor after `this._stepSize` is set — never invoked
   * automatically by base-class control flow — so subclasses without dual averaging (RWM,
   * AdaptiveMetropolis, Slice, MALA, Gibbs) are unaffected. Restoring these (rather than always
   * restarting from t=0) is what makes a mid-warm-up resume's dual averaging continue from the
   * exact same trajectory — decisions/0035-mcmc-exact-stream-reproducible-resume.md.
   *
   * @method _restoreDualAveraging
   * @memberof ran.mc.MCMC
   * @protected
   * @ignore
   */
  _restoreDualAveraging () {
    // this.constructor.name resolves to the concrete subclass (HMC or NUTS) so error messages
    // match each subclass's own `_validateOptions` labeling convention without a third parameter.
    // Validated the same way stepSize already is: a malformed resumed field must fail loudly
    // rather than silently corrupt the Robbins-Monro recursion — solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md.
    const label = this.constructor.name
    MCMC._validateFiniteScalar(this.internal.daMu, `${label}: resumed daMu`)
    MCMC._validateFiniteScalar(this.internal.daHbar, `${label}: resumed daHbar`)
    MCMC._validateFiniteScalar(this.internal.daLogEpsBar, `${label}: resumed daLogEpsBar`)
    MCMC._validateNonNegativeInteger(this.internal.daT, `${label}: resumed daT`)

    this._daMu = this.internal.daMu !== undefined ? this.internal.daMu : Math.log(10 * this._stepSize)
    this._daHbar = this.internal.daHbar || 0
    this._daLogEpsBar = this.internal.daLogEpsBar !== undefined ? this.internal.daLogEpsBar : Math.log(this._stepSize)
    this._daT = this.internal.daT || 0
  }

  /**
   * Performs a single iteration. Must be overridden.
   *
   * @method _iter
   * @memberof ran.mc.MCMC
   * @param {number[]} x Current state of the Markov chain.
   * @param {boolean=} warmUp Whether the iteration takes place during warm-up. Default is false.
   * @returns {{x: number[], accepted: boolean, alpha?: number}} New state and whether it was
   * accepted. `alpha` is optional and subclass-defined — e.g. HMC returns the continuous
   * Metropolis acceptance probability for dual-averaging step-size adaptation (see
   * decisions/0025-hmc-iter-alpha-field.md). Ignored by the base class's own consumer of this
   * return value.
   * @protected
   * @ignore
   */
  _iter (x, warmUp) {
    throw Error('MCMC._iter() is not implemented')
  }

  /**
   * Adjusts internal parameters after an iteration. Must be overridden.
   *
   * @method _adjust
   * @memberof ran.mc.MCMC
   * @param {Object} i Result of the last iteration.
   * @protected
   * @ignore
   */
  _adjust (i) {
    throw Error('MCMC._adjust() is not implemented')
  }

  // Thins to where autocorrelation has decayed to near-zero so sample() returns closer-to-independent
  // draws, using the slowest-mixing dimension as the bound — 0.05 cutoff rationale in decisions/0020-mcmc-design.md
  _thinningLag () {
    return this.ac().reduce((first, d) => {
      let lastValid = 0
      for (let i = 0; i < d.length - 1; i++) {
        if (isNaN(d[i])) continue
        if (Math.abs(d[i]) <= 0.05) {
          return Math.max(first, i)
        }
        lastValid = i
      }
      // No lag decorrelated within the measured range: the chain mixes slower than
      // maxLag can resolve, so fall back to the largest lag we could actually
      // evaluate. Returning 0 here would mark the slowest-mixing dimension as
      // "already decorrelated" and drive samplingRate DOWN, inverting the
      // "slowest dimension wins" rule — decisions/0020-mcmc-design.md §3.
      return Math.max(first, lastValid)
    }, 0)
  }

  _adjustSamplingRate (lag) {
    if (lag > this.samplingRate) {
      this.samplingRate++
    } else if (lag < this.samplingRate && this.samplingRate > 1) {
      this.samplingRate--
    }
  }

  // Update recurrences, derivations, and invariants for all three accumulators
  // below are contractual — see decisions/0023-mcmc-accumulator-mechanics.md.
  _initAccumulators () {
    // Welford online mean/variance per dimension — O(1) per update, avoids naive-formula cancellation; decisions/0020-mcmc-design.md
    this._welford = Array.from({ length: this.dim }, () => ({ n: 0, mean: 0, M2: 0 }))
    // Circular buffer + running cross-product sums for online autocorrelation — O(dim*maxLag) per query, replacing the old O(maxHistory) full rescan; decisions/0020-mcmc-design.md
    this._acN = 0
    this._acBuf = Array.from({ length: this.dim }, () => new Float64Array(this.maxLag))
    this._acCross = Array.from({ length: this.dim }, () => new Float64Array(this.maxLag))
    // Circular buffer of accept/reject outcomes for the windowed ar() — decisions/0021-mcmc-windowed-acceptance-rate.md
    this._arN = 0
    this._arCount = 0
    this._arBuf = new Uint8Array(this._arWindow)
  }

  _updateAccumulators (x, accepted) {
    // O(1) sliding window for ar() (decisions/0021-mcmc-windowed-acceptance-rate.md) instead of
    // rescanning the last arWindow outcomes on every ar() call
    const arCursor = this._arN % this._arWindow
    const arValue = accepted ? 1 : 0
    this._arCount += arValue - this._arBuf[arCursor]
    this._arBuf[arCursor] = arValue
    this._arN++

    for (let d = 0; d < this.dim; d++) {
      const v = x[d]

      // Welford update
      const w = this._welford[d]
      w.n++
      const delta = v - w.mean
      w.mean += delta / w.n
      w.M2 += delta * (v - w.mean)

      // Cross-product sums: cross[r] accumulates sum of x[i]*x[i-r]
      const buf = this._acBuf[d]
      const cross = this._acCross[d]
      const n = this._acN
      cross[0] += v * v
      for (let r = 1; r < Math.min(n + 1, this.maxLag); r++) {
        cross[r] += v * buf[((n - r) % this.maxLag + this.maxLag) % this.maxLag]
      }
      buf[n % this.maxLag] = v
    }
    this._acN++
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validateDim (dim) {
    if (dim === undefined) {
      return
    }
    if (!MCMC._isPositiveInteger(dim)) {
      throw Error('MCMC: dim must be a positive integer')
    }
    // Bounds per-dimension array allocations (Welford accumulators, autocorrelation buffers)
    // in the constructor; unbounded dim otherwise lets a caller trigger an OOM crash. See #916.
    if (dim > MCMC._MAX_DIM) {
      throw Error(`MCMC: dim must be at most ${MCMC._MAX_DIM}`)
    }
  }

  // Kept out of the constructor to avoid a Complex Conditional / Complex Method smell there.
  static _validateMaxLag (maxLag) {
    if (maxLag === undefined) {
      return
    }
    if (!MCMC._isPositiveInteger(maxLag)) {
      throw Error('MCMC: maxLag must be a positive integer')
    }
    // Bounds the per-dimension _acBuf/_acCross Float64Array allocations in _initAccumulators();
    // unbounded maxLag otherwise lets a caller trigger an OOM crash. See #922.
    if (maxLag > MCMC._MAX_LAG) {
      throw Error(`MCMC: maxLag must be at most ${MCMC._MAX_LAG}`)
    }
  }

  // Kept out of the constructor to avoid a Complex Method smell there. Runs on
  // the resolved dim/maxLag (after _resolveConfig), not raw config, so it
  // doesn't duplicate _resolveConfig's default-filling logic — see #928.
  static _validateCombinedFootprint (dim, maxLag) {
    if (dim * maxLag * 16 > MCMC._MAX_ACCUMULATOR_BYTES) {
      throw Error(`MCMC: dim * maxLag must be at most ${Math.floor(MCMC._MAX_ACCUMULATOR_BYTES / 16)} (got ${dim * maxLag})`)
    }
  }

  // Guards new Uint8Array(arWindow) in _initAccumulators() the same way _validateDim guards the
  // per-dimension array allocations — an unvalidated non-integer arWindow silently corrupts the
  // ring-buffer cursor arithmetic in _updateAccumulators() into permanent NaN.
  static _validateArWindow (arWindow) {
    if (arWindow === undefined) {
      return
    }
    if (!MCMC._isPositiveInteger(arWindow)) {
      throw Error('MCMC: arWindow must be a positive integer')
    }
    // Bounds the new Uint8Array(arWindow) allocation in _initAccumulators();
    // unbounded arWindow otherwise lets a caller trigger an OOM crash, the
    // same gap _MAX_DIM/_MAX_LAG closed for dim/maxLag. See #928 and
    // solutions/correctness/2026-07-13-1624-mcmc-arwindow-sibling-bound-gap.md
    if (arWindow > MCMC._MAX_AR_WINDOW) {
      throw Error(`MCMC: arWindow must be at most ${MCMC._MAX_AR_WINDOW}`)
    }
  }

  // Shared by the base constructor (initialState.prng) and every _q-owning subclass
  // (initialState.internal.prngQ) — a malformed 4-element-array assumption, if silently
  // accepted, would corrupt every subsequent draw rather than fail loudly. See
  // solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md and
  // decisions/0035-mcmc-exact-stream-reproducible-resume.md.
  static _validatePrngState (state, label) {
    if (state === undefined) {
      return
    }
    if (!MCMC._isValidPrngState(state)) {
      throw Error(`${label}: prng state must be an array of 4 finite numbers`)
    }
  }

  // Split from _validatePrngState so the compound check is a single return expression rather
  // than a branch condition, which is what the Complex Conditional smell flags.
  static _isValidPrngState (state) {
    return Array.isArray(state) && state.length === 4 && state.every(Number.isFinite)
  }

  // Shared by every _q-owning subclass (RWM, AdaptiveMetropolis, HMC, NUTS, MALA) so each
  // constructor collapses its validate-then-load branch into a single call, keeping the
  // constructor's own cyclomatic complexity low (see the per-file "Kept out of the constructor
  // to avoid a Complex Method smell there" convention already used throughout this codebase).
  // decisions/0035-mcmc-exact-stream-reproducible-resume.md
  static _restoreQPrng (q, prngQ, label) {
    MCMC._validatePrngState(prngQ, label)
    if (prngQ) {
      q.r.load(prngQ)
    }
  }

  // Shared by HMC and NUTS's mass-matrix accumulator restoration so each field's fallback is a
  // single expression rather than a repeated branch, which is what the Complex Method smell
  // flags. `!== undefined` (not `||`) so a legitimately-zero resumed value (e.g. metN: 0) is
  // preserved rather than mistaken for absent. decisions/0035-mcmc-exact-stream-reproducible-resume.md
  static _resolveResumedField (resumed, key, fallback) {
    return (resumed && resumed[key] !== undefined) ? resumed[key] : fallback
  }

  // Shared by every subclass restoring a resumed adaptation-batch accumulator field (Robbins-Monro
  // counters, dual-averaging state, covariance/mass-matrix accumulators) — a malformed field, if
  // silently accepted, corrupts the adaptation recursion (e.g. a non-finite pAccepted/daT) rather
  // than failing loudly, the same class of gap solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md
  // fixed for stepSize/pathLength. decisions/0035-mcmc-exact-stream-reproducible-resume.md — these
  // validators were themselves added only after an independent /review pass caught their absence
  // in the initial implementation, despite the ADR above stating the rule in the same commit; see
  // solutions/correctness/2026-07-19-1400-mcmc-resume-accumulator-validation-gap.md.
  // `label` is the complete phrase preceding "must be" (e.g. 'RWM: resumed base'), matching the
  // subclass-specific `_validateOptions` error convention already used throughout this codebase.
  static _validateFiniteScalar (value, label) {
    if (value === undefined) {
      return
    }
    if (!Number.isFinite(value)) {
      throw Error(`${label} must be a finite number`)
    }
  }

  static _validateNonNegativeInteger (value, label) {
    if (value === undefined) {
      return
    }
    if (!(Number.isInteger(value) && value >= 0)) {
      throw Error(`${label} must be a non-negative integer`)
    }
  }

  static _validateFiniteVector (value, dim, label) {
    if (value === undefined) {
      return
    }
    if (!MCMC._isFiniteVectorOfLength(value, dim)) {
      throw Error(`${label} must be an array of ${dim} finite numbers`)
    }
  }

  static _validateFiniteMatrix (value, dim, label) {
    if (value === undefined) {
      return
    }
    if (!MCMC._isFiniteMatrixOfDim(value, dim)) {
      throw Error(`${label} must be a ${dim} x ${dim} array of finite numbers`)
    }
  }

  // Split out so each validator's compound check is a single return expression rather than a
  // branch condition, which is what the Complex Conditional smell flags.
  static _isFiniteVectorOfLength (value, length) {
    return Array.isArray(value) && value.length === length && value.every(Number.isFinite)
  }

  static _isFiniteMatrixOfDim (value, dim) {
    return Array.isArray(value) && value.length === dim && value.every(row => MCMC._isFiniteVectorOfLength(row, dim))
  }

  // Kept out of the constructor to avoid a Complex Method smell there.
  static _resolveConfig (config) {
    return {
      dim: config.dim || 1,
      maxLag: config.maxLag || 100,
      arWindow: config.arWindow || 1000
    }
  }

  static _isPositiveInteger (dim) {
    return Number.isInteger(dim) && dim >= 1
  }

  static get _MAX_DIM () {
    return 10000
  }

  static get _MAX_LAG () {
    return 10000
  }

  // _arBuf = new Uint8Array(arWindow) is a single flat allocation, 1 byte per
  // element — same order-of-magnitude cap as _MAX_DIM/_MAX_LAG for
  // consistency, even though a Uint8Array is far cheaper per element than the
  // Float64Arrays those bounds guard. See #928.
  static get _MAX_AR_WINDOW () {
    return 10000
  }

  // _acBuf/_acCross together allocate dim*maxLag*16 bytes (two Float64Arrays
  // per dimension, 8 bytes/element each); 100MB is an order-of-magnitude
  // budget well below typical heap limits while still permitting dim at its
  // individual maximum (_MAX_DIM = 10000) with the default maxLag (100) —
  // 16MB. See #928.
  static get _MAX_ACCUMULATOR_BYTES () {
    return 100e6
  }
}
