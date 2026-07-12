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
 * </ul>
 * @param {Object=} initialState Initial state of the sampler. Supported properties: {x} (starting
 * position), {samplingRate} (thinning interval), and {internal} for subclass-specific state.
 * @constructor
 * @throws {Error} If config.dim is provided but is not a positive integer, or exceeds the maximum allowed dimension.
 */
// decisions/0020-mcmc-design.md — accumulator design and the _iter/_adjust/_internal subclass contract
export default class MCMC {
  constructor (logDensity, config = {}, initialState = {}) {
    if (new.target === MCMC) {
      throw Error('MCMC is abstract and cannot be instantiated directly.')
    }
    MCMC._validateDim(config.dim)
    this.dim = config.dim || 1
    this.maxLag = config.maxLag || 100
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
   * Computes the cumulative acceptance rate since the last reset.
   *
   * @method ar
   * @memberof ran.mc.MCMC
   * @returns {number} Fraction of proposals accepted.
   */
  ar () {
    return this._totalIter > 0 ? this._accepted / this._totalIter : 0
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
    for (let batch = 0; batch <= maxBatches; batch++) {
      for (let j = 0; j < 1e4; j++) {
        this._adjust(this.iterate(null, true))
      }
      this._adjustSamplingRate(this._thinningLag())
      typeof progress === 'function' && progress(100 * batch / maxBatches)
    }
  }

  /**
   * Samples from the target density. Resets accumulators so that statistics() and ar() reflect
   * the sampling phase only. Thins the chain by samplingRate (set during warm-up).
   *
   * @method sample
   * @memberof ran.mc.MCMC
   * @param {Function=} progress Called with the percentage complete (0–100) at 1% intervals.
   * @param {number=} size Number of samples to collect. Default is 1000.
   * @returns {number[][]} Array of sampled states.
   */
  sample (progress, size = 1000) {
    // Reset so warm-up's adaptation-phase draws don't blend into sampling-phase statistics — decisions/0020-mcmc-design.md
    this._initAccumulators()
    const iMax = this.samplingRate * size
    const batchSize = iMax / 100
    const samples = []
    for (let i = 0; i < iMax; i++) {
      this.iterate()
      if (i % batchSize === 0 && typeof progress === 'function') {
        progress(i / batchSize)
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
  _iter () {
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
  _adjust () {
    throw Error('MCMC._adjust() is not implemented')
  }

  // Thins to where autocorrelation has decayed to near-zero so sample() returns closer-to-independent
  // draws, using the slowest-mixing dimension as the bound — 0.05 cutoff rationale in decisions/0020-mcmc-design.md
  _thinningLag () {
    return this.ac().reduce((first, d) => {
      for (let i = 0; i < d.length - 1; i++) {
        if (!isNaN(d[i]) && Math.abs(d[i]) <= 0.05) {
          return Math.max(first, i)
        }
      }
      return first
    }, 0)
  }

  _adjustSamplingRate (lag) {
    if (lag > this.samplingRate) {
      this.samplingRate++
    } else if (lag < this.samplingRate && this.samplingRate > 1) {
      this.samplingRate--
    }
  }

  _initAccumulators () {
    this._accepted = 0
    this._totalIter = 0
    // Welford online mean/variance per dimension — O(1) per update, avoids naive-formula cancellation; decisions/0020-mcmc-design.md
    this._welford = Array.from({ length: this.dim }, () => ({ n: 0, mean: 0, M2: 0 }))
    // Circular buffer + running cross-product sums for online autocorrelation — O(dim*maxLag) per query, replacing the old O(maxHistory) full rescan; decisions/0020-mcmc-design.md
    this._acN = 0
    this._acBuf = Array.from({ length: this.dim }, () => new Float64Array(this.maxLag))
    this._acCross = Array.from({ length: this.dim }, () => new Float64Array(this.maxLag))
  }

  _updateAccumulators (x, accepted) {
    this._totalIter++
    if (accepted) this._accepted++

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

  static _isPositiveInteger (dim) {
    return Number.isInteger(dim) && dim >= 1
  }

  static get _MAX_DIM () {
    return 10000
  }
}
