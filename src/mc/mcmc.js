/**
 * Base class implementing a general Markov chain Monte Carlo sampler. All MCMC sampler is extended from this class.
 * MCMC samplers can be used to approximate integrals by efficiently sampling a density that cannot be normalized or
 * sampled directly.
 *
 * @class MCMC
 * @memberof ran.mc
 * @param {Function} logDensity The logarithm of the density function to estimate.
 * @param {Object=} config Object describing some configurations. Supported properties:
 * <ul>
 *     <li>{dim}: Dimension of the state space to sample. Default is 1.</li>
 *     <li>{maxHistory}: Maximum length of history for aggregated computations. Default is 1000.</li>
 * </ul>
 * @param {Object=} initialState The initial internal state of the sampler. Supported properties: {x} (the
 * starting state), {samplingRate} (sampling rate) and {internal} for the child class' own internal parameters.
 * @constructor
 */
export default class {
  constructor (logDensity, config = {}, initialState = {}) {
    this.dim = config.dim || 1
    this.maxHistory = config.maxHistory || 1e4
    this.lnp = logDensity
    this.x = initialState.x || Array.from({ length: this.dim }, Math.random)
    this.samplingRate = initialState.samplingRate || 1
    this.internal = initialState.internal || {}

    /**
     * State history of the sampler.
     *
     * @namespace history
     * @memberof ran.mc.MCMC
     * @private
     */
    this.history = (function (self) {
      const _arr = Array.from({ length: self.dim }, () => [])

      return {
        /**
         * Returns the current history.
         *
         * @method get
         * @memberof ran.mc.MCMC.history
         * @return {Array} Current history.
         * @private
         */
        get () {
          return _arr
        },

        /**
         * Updates state history with new data.
         *
         * @method update
         * @memberof ran.mc.MCMC.history
         * @param {Array} x Last state to update history with.
         */
        update (x) {
          // Add new state
          _arr.forEach((d, j) => d.push(x[j]))

          // Remove old state
          if (_arr[0].length >= self.maxHistory) {
            _arr.forEach(d => d.shift())
          }
        }
      }
    })(this)

    /**
     * Acceptance ratio.
     *
     * @namespace acceptance
     * @memberof ran.mc.MCMC
     * @private
     */
    this.acceptance = (function (self) {
      const _arr = []

      return {
        /**
         * Computes acceptance for the current historical data.
         *
         * @method compute
         * @memberof ran.mc.MCMC.acceptance
         * @return {number} Acceptance ratio.
         */
        compute () {
          return _arr.reduce((acc, d) => d + acc) / _arr.length
        },

        /**
         * Updates acceptance history with new data.
         *
         * @method update
         * @memberof ran.mc.MCMC.acceptance
         * @param {number} a Acceptance: 1 if last state was accepted, 0 otherwise.
         */
        update (a) {
          _arr.push(a)
          if (_arr.length > self.maxHistory) {
            _arr.shift()
          }
        }
      }
    })(this)
  }

  /**
   * Returns the internal variables of the class. Must be overridden.
   *
   * @method _internal
   * @memberof ran.mc.MCMC
   * @returns {Object} Object containing the internal variables.
   * @private
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
   * @param {boolean=} warmUp Whether iteration takes place during warm-up or not. Default is false.
   * @returns {{x: Array, accepted: boolean}} Object containing the new state ({x}) and whether it is a
   * genuinely new state or not ({accepted}).
   * @private
   */
  _iter () {
    throw Error('MCMC._iter() is not implemented')
  }

  /**
   * Adjusts internal parameters. Must be overridden.
   *
   * @method _adjust
   * @memberof ran.mc.MCMC
   * @param {Object} i Object containing the result of the last iteration.
   * @private
   */
  _adjust () {
    throw Error('MCMC._adjust() is not implemented')
  }

  /**
   * Returns the current state of the sampler. The return value of this method can be passed to a sampler of
   * the same type to continue a previously warmed up sampler.
   *
   * @method state
   * @memberof ran.mc.MCMC
   * @returns {Object} Object containing all relevant parameters of the sampler.
   */
  state () {
    return {
      x: this.x,
      samplingRate: this.samplingRate,
      internals: this._internal()
    }
  }

  /**
   * Computes basic statistics of the sampled state variables based on historical data. Returns mean,
   * standard deviation and coefficient of variation.
   *
   * @method statistics
   * @memberof ran.mc.MCMC
   * @returns {Object[]} Array containing objects for each dimension. Objects contain <code>mean</code>, <code>std</code> and <code>cv</code>.
   */
  statistics () {
    return this.history.get().map(h => {
      const m = h.reduce((sum, d) => sum + d, 0) / h.length

      const s = h.reduce((sum, d) => sum + (d - m) * (d - m), 0) / h.length
      return {
        mean: m,
        std: s,
        cv: s / m
      }
    })
  }

  /**
   * Computes acceptance rate based on historical data.
   *
   * @method ar
   * @memberof ran.mc.MCMC
   * @returns {number} The acceptance rate in the last several iterations.
   */
  ar () {
    return this.acceptance.compute()
  }

  /**
   * Computes the auto-correlation function for each dimension based on historical data.
   *
   * @method ac
   * @memberof ran.mc.MCMC
   * @returns {number[][]} Array containing the correlation function (correlation versus lag) for each
   * dimension.
   */
  ac () {
    // return this._ac.compute();
    return this.history.get().map(h => {
      // Get average
      const m = h.reduce((s, d) => s + d) / h.length

      const m2 = h.reduce((s, d) => s + d * d)

      const rho = new Array(100).fill(0)
      for (let i = 0; i < h.length; i++) {
        for (let r = 0; r < rho.length; r++) {
          if (i - r > 0) {
            rho[r] += (h[i] - m) * (h[i - r] - m)
          }
        }
      }

      // Return auto-correlation for each dimension
      return rho.map(function (d) {
        return d / (m2 - h.length * m * m)
      })
    })
  }

  /**
   * Performs a single iteration.
   *
   * @method iterate
   * @memberof ran.mc.MCMC
   * @param {Function=} callback Callback to trigger after the iteration.
   * @param {boolean=} warmUp Whether iteration takes place during warm-up or not. Default is false.
   * @returns {Object} Object containing the new state (<code>x</code>) and whether it is a
   * genuinely new state or not (<code>accepted</code>).
   */
  iterate (callback = null, warmUp = false) {
    // Get new state
    const i = this._iter(this.x, warmUp)

    // Update accumulators
    this.history.update(i.x)
    this.acceptance.update(i.accepted)

    // Update state
    this.x = i.x

    // Callback
    callback && callback(i.x, i.accepted)

    return i
  }

  /**
   * Carries out the initial warm-up phase of the sampler. During this phase, internal parameters may change
   * and therefore sampling does not take place. Instead, all relevant variables are adjusted.
   *
   * @method warmUp
   * @memberof ran.mc.MCMC
   * @param {Function} progress Callback function to call when an integer percentage of the warm-up is done.
   * The percentage of the finished batches is passed as a parameter.
   * @param {number=} maxBatches Maximum number of batches for warm-up. Each batch consists of 10K iterations.
   * Default value is 100.
   */
  warmUp (progress, maxBatches = 100) {
    // Run specified batches
    for (let batch = 0; batch <= maxBatches; batch++) {
      // Do some iterations
      for (let j = 0; j < 1e4; j++) {
        this._adjust(this.iterate(null, true))
        // this._ac.update(this.x);
      }

      // Adjust sampling rate
      // Get highest zero point
      const z = this.ac().reduce((first, d) => {
        for (let i = 0; i < d.length - 1; i++) {
          if (Math.abs(d[i]) <= 0.05) {
            return Math.max(first, i)
          }
        }
        return first
      }, 0)
      // Change sampling rate if zero point is different
      if (z > this.samplingRate) {
        this.samplingRate++
      } else if (z < this.samplingRate && this.samplingRate > 1) {
        this.samplingRate--
      }

      // Call optional callback
      if (typeof progress !== 'undefined') {
        progress(100 * batch / maxBatches)
      }
    }
  }

  /**
   * Performs the sampling of the target density. Note that during sampling, no parameter adjustment is
   * taking place.
   *
   * @method sample
   * @memberof ran.mc.MCMC
   * @param {Function} progress Callback function to call when an integer percentage of the samples is
   * collected. The percentage of the samples already collected is passed as a parameter.
   * @param {number=} size Size of the sampled set. Default is 1000.
   * @returns {Array} Array containing the collected samples.
   */
  sample (progress, size = 1000) {
    // Calculate total iterations
    const iMax = this.samplingRate * size

    const batchSize = iMax / 100

    const samples = []

    // Start sampling
    for (let i = 0; i < iMax; i++) {
      this.iterate()

      // Adjust occasionally, also send progress status
      if (i % batchSize === 0 && typeof progress !== 'undefined') {
        progress(i / batchSize)
      }

      // Collect sample
      if (i % this.samplingRate === 0) {
        samples.push(this.x)
      }
    }

    return samples
  }
}
