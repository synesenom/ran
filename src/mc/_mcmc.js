import Xoshiro128p from '../core/xoshiro'

/**
 * Base class implementing a general Markov chain Monte Carlo sampler. All MCMC samplers extend this class.
 * MCMC samplers approximate integrals by efficiently sampling a density that cannot be normalized or
 * sampled directly.
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
 * @throws {Error} If config.arWindow is provided but is not a positive integer.
 */
// decisions/0020-mcmc-design.md — accumulator design and the _iter/_adjust/_internal subclass contract
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
    this.lnp = logDensity
    this.r = new Xoshiro128p()
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
   * @returns {Object} Object with properties: x (current position), samplingRate (thinning interval), and internal (subclass state).
   */
  state () {
    return {
      x: this.x,
      samplingRate: this.samplingRate,
      internal: this._internal() // key must match what constructor reads; see solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md
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
   * @returns {{x: number[], accepted: boolean}} Result of the iteration.
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
   * Performs a single iteration. Must be overridden.
   *
   * @method _iter
   * @memberof ran.mc.MCMC
   * @param {number[]} x Current state of the Markov chain.
   * @param {boolean=} warmUp Whether the iteration takes place during warm-up. Default is false.
   * @returns {{x: number[], accepted: boolean}} New state and whether it was accepted.
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
  // below are documented in src/mc/ACCUMULATORS.md.
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
}
