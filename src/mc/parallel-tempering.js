import RWM from './rwm'
import Xoshiro128p from '../core/xoshiro'

// Same order-of-magnitude cap as MCMC._MAX_DIM / run-chains.js's _MAX_CHAINS — an unbounded
// replica count multiplies the per-instance accumulator footprint those bounds already guard,
// one replica at a time.
const _MAX_REPLICAS = 10000

/**
 * Class implementing [Parallel Tempering]{@link https://doi.org/10.1090/conm/026} (Replica Exchange MCMC,
 * Geyer 1991) to sample multimodal targets. Runs N independent {@link ran.mc.MCMC} replicas at inverse
 * temperatures beta_1 = 1 > beta_2 > ... > beta_n, replica i targeting `beta_i * logDensity(x)`. Hot
 * replicas (small beta) have a flattened target and cross low-probability barriers between modes easily;
 * the cold replica (beta = 1) samples the true target. After each thinned step, a swap between one
 * alternating-parity set of adjacent replica pairs is proposed and accepted with probability
 * `min(1, exp((beta_i - beta_j) * (logDensity(x_j) - logDensity(x_i))))` (the direction that follows from
 * detailed balance on the joint replica distribution; see the `_proposeSwap` implementation comment),
 * letting the cold chain inherit the hot chains' mode-crossing moves.
 *
 * Unlike every other class in `ran.mc`, this is not an {@link ran.mc.MCMC} subclass: it has no single
 * position or target density of its own, only an array of independent replicas and the swap logic that
 * couples them (see decisions/0028-parallel-tempering-standalone-coordinator.md). Each replica keeps
 * its own proposal tuning pinned to its temperature slot; an accepted swap exchanges only the replicas'
 * positions (and, where present, their cached scaled log-density), not their adaptation state.
 *
 * @class ParallelTempering
 * @memberof ran.mc
 * @param {Function} logDensity The logarithm of the (unnormalized) target density.
 * @param {Object=} options Configuration. Supported properties:
 * <ul>
 *   <li>{temperatures}: Explicit, strictly descending array of inverse temperatures starting at 1.
 *   At least two are required. Takes precedence over nReplicas/tempMax if provided.</li>
 *   <li>{nReplicas}: Number of replicas for an auto-generated geometric ladder. At least 2, at most 10000.</li>
 *   <li>{tempMax}: Ratio of the coldest to the hottest inverse temperature for the geometric ladder
 *   (beta_n = 1 / tempMax). Must be a finite number greater than 1.</li>
 *   <li>{sampler}: Factory `(scaledLogDensity, config) => MCMC` building one replica. Defaults to RWM.</li>
 *   <li>{config}: Configuration object forwarded unchanged to every replica's constructor.</li>
 * </ul>
 * @constructor
 * @throws {Error} If logDensity is not a function.
 * @throws {Error} If neither temperatures nor nReplicas and tempMax are provided, or if they are invalid.
 */
// decisions/0028-parallel-tempering-standalone-coordinator.md — not an MCMC subclass; swaps positions
// only, via direct field mutation, keeping adaptation state pinned to its temperature slot
export default class ParallelTempering {
  constructor (logDensity, options = {}) {
    if (typeof logDensity !== 'function') {
      throw Error('ParallelTempering: logDensity must be a function')
    }
    this.temperatures = ParallelTempering._resolveLadder(options)
    this._logDensity = logDensity
    this._sampler = options.sampler || ((lnp, config) => new RWM(lnp, config))
    this._config = options.config || {}
    this._replicas = this.temperatures.map(beta => this._sampler(x => beta * this._logDensity(x), this._config))
    this._swapAttempts = new Array(this.temperatures.length - 1).fill(0)
    this._swapAccepts = new Array(this.temperatures.length - 1).fill(0)
    this.r = new Xoshiro128p()
  }

  // ─── PUBLIC INSTANCE ───

  /**
   * Sets the seed for the coordinator's own pseudo random number generator (used for swap-acceptance
   * draws) and reseeds every replica with a distinct, deterministically derived seed.
   *
   * @method seed
   * @memberof ran.mc.ParallelTempering
   * @param {number|string} value The value of the seed, either a number or a string.
   * @returns {this} Reference to the current sampler.
   */
  seed (value) {
    this.r.seed(value)
    this._replicas.forEach((replica, i) => replica.seed(`${value}-${i}`))
    return this
  }

  /**
   * Warms up every replica independently (no swaps are proposed during warm-up).
   *
   * @method warmUp
   * @memberof ran.mc.ParallelTempering
   * @param {Function=} progress Called with the percentage complete (0-100) after each replica finishes.
   * @param {number=} maxBatches Number of warm-up batches per replica. Default is 100.
   */
  warmUp (progress, maxBatches = 100) {
    this._replicas.forEach((replica, i) => {
      replica.warmUp(null, maxBatches)
      typeof progress === 'function' && progress(100 * (i + 1) / this._replicas.length)
    })
  }

  /**
   * Runs all replicas in lockstep and proposes swaps between adjacent replica pairs. Each round
   * advances every replica by as many raw iterations as the slowest-thinning replica's own
   * samplingRate requires, then proposes one alternating-parity set of adjacent swaps.
   *
   * @method sample
   * @memberof ran.mc.ParallelTempering
   * @param {Function=} progress Called with the integer percentage complete (0-99), once per percent.
   * @param {number=} size Number of samples to collect from the cold (beta = 1) replica. Default is 1000.
   * @returns {number[][]} Array of sampled states from the cold replica.
   */
  sample (progress, size = 1000) {
    this._swapAttempts.fill(0)
    this._swapAccepts.fill(0)
    const stride = Math.max(...this._replicas.map(r => r.samplingRate))
    const samples = []
    let lastPct = -1
    for (let round = 0; round < size; round++) {
      this._advanceReplicas(stride)
      this._proposeSwap(round % 2)
      samples.push(this._replicas[0].x.slice())
      if (typeof progress === 'function') {
        const pct = Math.floor(100 * round / size)
        if (pct > lastPct) {
          lastPct = pct
          progress(pct)
        }
      }
    }
    return samples
  }

  /**
   * Computes the fraction of proposed swaps accepted for each adjacent replica pair, since the last
   * `sample()` call.
   *
   * @method swapRate
   * @memberof ran.mc.ParallelTempering
   * @returns {number[]} Array of length `temperatures.length - 1`, one accepted/attempted fraction per
   * adjacent pair, in ladder order.
   */
  swapRate () {
    return this._swapAttempts.map((n, i) => n > 0 ? this._swapAccepts[i] / n : 0)
  }

  // ─── PRIVATE INSTANCE ───

  _advanceReplicas (stride) {
    this._replicas.forEach(replica => {
      for (let j = 0; j < stride; j++) {
        replica.iterate()
      }
    })
  }

  // Proposes one adjacent-pair swap per parity class (even pairs (0,1),(2,3),... on parity 0, odd
  // pairs (1,2),(3,4),... on parity 1), alternated round by round so every adjacent pair is
  // eventually proposed while any single round only ever touches disjoint pairs.
  //
  // Acceptance uses (lnpJ - lnpI), not (lnpI - lnpJ): detailed balance on the joint distribution
  // Pi(x_1,...,x_n) = prod_k p(x_k)^{beta_k} gives, for a swap trading x_i <-> x_j between two
  // replicas at beta_i > beta_j, Pi(after)/Pi(before) = exp[(beta_i - beta_j)(log p(x_j) - log p(x_i))]
  // -- the replica that currently holds the *lower*-density position must inherit the other's
  // position with probability related to how much better that position is. Issue #830's prose
  // states (log p(x_i) - log p(x_j)); that is the reciprocal of the correct ratio and empirically
  // produces the wrong stationary distribution (an inflated-variance cold chain, verified against
  // a bimodal KS test during implementation) -- implemented here as derived, not as literally quoted.
  _proposeSwap (parity) {
    for (let i = parity; i + 1 < this._replicas.length; i += 2) {
      this._swapAttempts[i]++
      const lnpI = this._logDensity(this._replicas[i].x)
      const lnpJ = this._logDensity(this._replicas[i + 1].x)
      const alpha = Math.exp((this.temperatures[i] - this.temperatures[i + 1]) * (lnpJ - lnpI))
      if (this.r.next() < alpha) {
        this._swapAccepts[i]++
        this._swapPositions(i, i + 1)
      }
    }
  }

  // Swaps positions only -- each replica's own adaptation state (proposal scale, covariance, step
  // size) stays pinned to its temperature slot; see decisions/0028-parallel-tempering-standalone-coordinator.md
  _swapPositions (i, j) {
    const replicaI = this._replicas[i]
    const replicaJ = this._replicas[j]
    const x = replicaI.x
    replicaI.x = replicaJ.x
    replicaJ.x = x
    // lastLnp is each replica's own SCALED log-density, cached against its (now stale) previous
    // position -- only Metropolis-family samplers (RWM, AdaptiveMetropolis, HMC) expose it.
    if ('lastLnp' in replicaI) replicaI.lastLnp = replicaI.lnp(replicaI.x)
    if ('lastLnp' in replicaJ) replicaJ.lastLnp = replicaJ.lnp(replicaJ.x)
  }

  // ─── PRIVATE STATIC ───

  static _resolveLadder (options) {
    if (options.temperatures !== undefined) {
      ParallelTempering._validateTemperatures(options.temperatures)
      return options.temperatures.slice()
    }
    if (options.nReplicas === undefined || options.tempMax === undefined) {
      throw Error('ParallelTempering: either temperatures or nReplicas and tempMax must be provided')
    }
    ParallelTempering._validateLadderParams(options.nReplicas, options.tempMax)
    return ParallelTempering._buildLadder(options.nReplicas, options.tempMax)
  }

  static _validateTemperatures (temperatures) {
    ParallelTempering._validateTemperaturesShape(temperatures)
    ParallelTempering._validateTemperaturesStart(temperatures)
    ParallelTempering._validateTemperaturesPositive(temperatures)
    ParallelTempering._validateTemperaturesDescending(temperatures)
  }

  static _validateTemperaturesShape (temperatures) {
    if (!Array.isArray(temperatures) || temperatures.length < 2) {
      throw Error('ParallelTempering: temperatures must be an array of at least two values')
    }
  }

  static _validateTemperaturesStart (temperatures) {
    if (temperatures[0] !== 1) {
      throw Error('ParallelTempering: temperatures[0] must equal 1')
    }
  }

  static _validateTemperaturesPositive (temperatures) {
    if (!temperatures.every(beta => Number.isFinite(beta) && beta > 0)) {
      throw Error('ParallelTempering: temperatures must contain only positive finite values')
    }
  }

  static _validateTemperaturesDescending (temperatures) {
    for (let i = 1; i < temperatures.length; i++) {
      if (!(temperatures[i] < temperatures[i - 1])) {
        throw Error('ParallelTempering: temperatures must be strictly descending')
      }
    }
  }

  static _validateLadderParams (nReplicas, tempMax) {
    ParallelTempering._validateNReplicas(nReplicas)
    ParallelTempering._validateTempMax(tempMax)
  }

  static _validateNReplicas (nReplicas) {
    if (!Number.isInteger(nReplicas) || nReplicas < 2) {
      throw Error('ParallelTempering: nReplicas must be an integer of at least two')
    }
    if (nReplicas > _MAX_REPLICAS) {
      throw Error(`ParallelTempering: nReplicas must be at most ${_MAX_REPLICAS}`)
    }
  }

  static _validateTempMax (tempMax) {
    if (!Number.isFinite(tempMax) || tempMax <= 1) {
      throw Error('ParallelTempering: tempMax must be a finite number greater than 1')
    }
  }

  static _buildLadder (nReplicas, tempMax) {
    return Array.from({ length: nReplicas }, (_, i) => Math.pow(tempMax, -i / (nReplicas - 1)))
  }
}
