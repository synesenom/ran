import { _sum } from './utils'
import dist from './dist'

/**
 * A collection of various Monte Carlo methods.
 *
 * @namespace mc
 * @memberOf ran
 */
export default (function () {
  /**
   * Maximum size of the history stored for calculations.
   *
   * @var {number} _MAX_HISTORY
   * @memberOf ran.mc
   * @private
   */
  const _MAX_HISTORY = 1e4

  let gr = (function () {
    /**
     * Calculates the G-R diagnostic for a single set of samples and a specified state dimension.
     *
     * @method _gri
     * @memberOf ran.mc.gr
     * @param {Array} samples Array of samples.
     * @param {number} dim Index of the state dimension to consider.
     * @returns {number} The G-R diagnostic.
     * @private
     */
    function _gri (samples, dim) {
      // Calculate sample statistics
      let m = []

      let s = []
      samples.forEach(function (d) {
        let di = d.map(function (x) {
          return x[dim]
        })
        let mi = _sum(di) / di.length

        let si = (_sum(di, 2) - di.length * mi * mi) / (di.length - 1)
        m.push(mi)
        s.push(si)
      })

      // Calculate within and between variances
      let w = _sum(s) / samples.length

      let mm = _sum(m) / samples.length

      let b = (_sum(m, 2) - samples.length * mm * mm) * samples[0].length / (samples.length - 1)

      let v = ((samples[0].length - 1) * w + b) / samples[0].length
      return Math.sqrt(v / w)
    }

    /**
     * Calculates the [Gelman-Rubin]{@link http://www.stat.columbia.edu/~gelman/research/published/brooksgelman2.pdf} diagnostics for a set
     * of samples. The statistics can be used to monitor the convergence of an MCMC model.
     *
     * @method gr
     * @memberOf ran.mc
     * @param {Array} samples Array of samples, where each sample is an array of states.
     * @param {number=} maxLength Maximum length of the diagnostic function. Default value is 1000.
     * @returns {Array} Array of Gelman-Rubin diagnostic versus iteration number for each state variable.
     */
    return function (samples, maxLength) {
      return samples[0][0].map(function (s, j) {
        return new Array(maxLength || 1000).fill(0).map(function (d, i) {
          return _gri(samples.map(function (dd) {
            return dd.slice(0, i + 2)
          }), j)
        })
      })
    }
  })()

  /*
      let Slice = (function(logDensity, config) {
          let _min = config && typeof config.min !== 'undefined' ? config.min : null,
              _max = config && typeof config.max !== 'undefined' ? config.max : null,
              _x = Math.random(),
              _e = new dist.Exponential(1);

          function _boundary(x) {
              return (!_min || x >= _min[0]) && (!_max || x >= _max[0]);
          }

          function _accept(x, z, l, r) {
              let L = l,
                  R = r,
                  D = false;

              while (R - L > 1.1) {
                  let M = (L + R) / 2;
                  D = (_x < M && x >= M) || (_x >= M && x < M);

                  if (x < M) {
                      R = M;
                  } else {
                      L = M;
                  }

                  if (D && z >= logDensity(L) && z >= logDensity(R)) {
                      return false;
                  }
              }

              return true;
          }

          function _iterate() {
              // Pick slice height
              let z = logDensity(_x) - _e.sample(),
                  L = _x - Math.random(),
                  R = L + 1;

              // Find slice interval
              while ((z < logDensity(L) || z < logDensity(R))) {
                  if (Math.random() < 0.5) {
                      L -= R - L;
                  } else {
                      R += R - L;
                  }
              }

              // Shrink interval
              let x = r(L, R);
              while (!_boundary(x) || z > logDensity(x) || !_accept(x, z, L, R)) {
                  if (x < _x) {
                      L = x;
                  } else {
                      R = x;
                  }
                  x = r(L, R);
              }

              // Update and return sample
              _x = x;
              return _x;
          }

          // Placeholder
          function burnIn() {
              return null;
          }

          function sample(size) {
              return new Array(size || 1e6).fill(0).map(function() {
                  return [_iterate()];
              });
          }

          // Public methods
          return {
              burnIn: burnIn,
              sample: sample
          };
      });
  */

  /**
   * Base class implementing a general Markov chain Monte Carlo sampler. All MCMC sampler is extended from this class. MCMC samplers can be used to approximate integrals
   * by efficiently sampling a density that cannot be normalized or sampled directly.
   *
   * @class MCMC
   * @memberOf ran.mc
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
  class MCMC {
    constructor (logDensity, config = {}, initialState = {}) {
      this.dim = config.dim || 1
      this.maxHistory = config.maxHistory || _MAX_HISTORY
      this.lnp = logDensity
      this.x = initialState.x || Array.from({ length: this.dim }, Math.random)
      this.samplingRate = initialState.samplingRate || 1
      this.internal = initialState.internal || {}

      /**
       * State history of the sampler.
       *
       * @namespace history
       * @memberOf ran.mc.MCMC
       * @private
       */
      this.history = (function (self) {
        let _arr = Array.from({ length: self.dim }, () => [])

        return {
          /**
           * Returns the current history.
           *
           * @method get
           * @memberOf ran.mc.MCMC.history
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
           * @memberOf ran.mc.MCMC.history
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
       * @memberOf ran.mc.MCMC
       * @private
       */
      this.acceptance = (function (self) {
        let _arr = []

        return {
          /**
           * Computes acceptance for the current historical data.
           *
           * @method compute
           * @memberOf ran.mc.MCMC.acceptance
           * @return {number} Acceptance ratio.
           */
          compute () {
            return _sum(_arr) / _arr.length
          },

          /**
           * Updates acceptance history with new data.
           *
           * @method update
           * @memberOf ran.mc.MCMC.acceptance
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
     * @memberOf ran.mc.MCMC
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
     * @memberOf ran.mc.MCMC
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
     * @memberOf ran.mc.MCMC
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
     * @memberOf ran.mc.MCMC
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
     * @memberOf ran.mc.MCMC
     * @returns {Object[]} Array containing objects for each dimension. Objects contain <code>mean</code>, <code>std</code> and <code>cv</code>.
     */
    statistics () {
      return this.history.get().map(h => {
        let m = h.reduce((sum, d) => sum + d, 0) / h.length

        let s = h.reduce((sum, d) => sum + (d - m) * (d - m), 0) / h.length
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
     * @memberOf ran.mc.MCMC
     * @returns {number} The acceptance rate in the last several iterations.
     */
    ar () {
      return this.acceptance.compute()
    }

    /**
     * Computes the auto-correlation function for each dimension based on historical data.
     *
     * @method ac
     * @memberOf ran.mc.MCMC
     * @returns {number[]} Array containing the correlation function (correlation versus lag) for each
     * dimension.
     */
    ac () {
      // return this._ac.compute();
      return this.history.get().map(h => {
        // Get average
        let m = h.reduce((s, d) => s + d) / h.length

        let m2 = h.reduce((s, d) => s + d * d)

        let rho = new Array(100).fill(0)
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
     * @memberOf ran.mc.MCMC
     * @param {Function=} callback Callback to trigger after the iteration.
     * @param {boolean=} warmUp Whether iteration takes place during warm-up or not. Default is false.
     * @returns {Object} Object containing the new state (<code>x</code>) and whether it is a
     * genuinely new state or not (<code>accepted</code>).
     */
    iterate (callback = null, warmUp = false) {
      // Get new state
      let i = this._iter(this.state.x, warmUp)

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
     * @memberOf ran.mc.MCMC
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
        let z = this.ac().reduce((first, d) => {
          for (let i = 0; i < d.length - 1; i++) {
            if (Math.abs(d[i]) <= 0.05) {
              return Math.max(first, i)
            }
          }
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
     * @memberOf ran.mc.MCMC
     * @param {Function} progress Callback function to call when an integer percentage of the samples is
     * collected. The percentage of the samples already collected is passed as a parameter.
     * @param {number=} size Size of the sampled set. Default is 1000.
     * @returns {Array} Array containing the collected samples.
     */
    sample (progress, size = 1000) {
      // Calculate total iterations
      let iMax = this.samplingRate * size

      let batchSize = iMax / 100

      let samples = []

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

  /**
   * Class implementing the (random walk) [Metropolis]{@link https://en.wikipedia.org/wiki/Metropolis%E2%80%93Hastings_algorithm}
   * algorithm.
   * Proposals are updated according to the [Metropolis-Within-Gibbs procedure]{@link http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.161.2424}:
   *
   * @class RWM
   * @memberOf ran.mc
   * @param {Function} logDensity The logarithm of the density function to estimate.
   * @param {Object=} config RWM configurations.
   * @param {Object=} initialState Initial state of the RWM sampler.
   * @constructor
   */
  class RWM extends MCMC {
    constructor (logDensity, config, initialState) {
      super(logDensity, config, initialState)

      // Last density value
      this.lastLnp = this.lnp(this.x)

      /**
       * Proposal distributions.
       *
       * @namespace proposal
       * @memberOf ran.mc.RWM
       * @private
       */
      this.proposal = (function (self) {
        let _q = new dist.Normal(0, 1)

        let _acceptance = new Array(self.dim).fill(0)

        let _sigma = self.internal.proposal || new Array(self.dim).fill(1)

        let _ls = _sigma.map(d => Math.log(d))

        let _n = 0

        let _batch = 0

        let _index = 0

        return {
          /**
           * Samples new state.
           *
           * @method jump
           * @memberOf ran.mc.RWM.proposal
           * @param {Array} x Current state.
           * @param {boolean} single Whether only a single dimension should be updated.
           * @return {Array} New state.
           */
          jump (x, single) {
            return single
              ? x.map((d, i) => d + (i === _index ? _q.sample() * _sigma[_index] : 0))
              : x.map((d, i) => d + _q.sample() * _sigma[i])
          },

          /**
           * Updates proposal distributions.
           *
           * @method update
           * @memberOf ran.mc.RWM.proposal
           * @param {boolean} accepted Whether last state was accepted.
           */
          update (accepted) {
            // Update acceptance for current dimension
            accepted && _acceptance[_index]++
            _n++

            // If batch is finished, update proposal
            if (_n === 100) {
              // Update proposal
              if (_acceptance[_index] / 100 > 0.44) {
                _ls[_index] += Math.min(0.01, Math.pow(_batch, -0.5))
              } else {
                _ls[_index] -= Math.min(0.01, Math.pow(_batch, -0.5))
              }
              _sigma[_index] = Math.exp(_ls[_index])

              // Reset counters and accumulators
              _n = 0
              _acceptance[_index] = 0
              _index = (_index + 1) % self.dim
              if (_index === 0) {
                _batch++
              }
            }
          },

          /**
           * Returns the current scales of the proposals.
           *
           * @method scales
           * @memberOf ran.mc.RWM.proposal
           * @return {Array} Array of proposal scales.
           */
          scales () {
            return _sigma.slice()
          }
        }
      })(this)
    }

    // Internal variables
    _internal () {
      return {
        proposal: this.proposal.scales()
      }
    }

    // Iterator
    _iter (x, warmUp) {
      let x1 = this.proposal.jump(this.x, warmUp)

      let newLnp = this.lnp(x1)

      let accepted = Math.random() < Math.exp(newLnp - this.lastLnp)
      if (accepted) {
        this.lastLnp = newLnp
      } else {
        x1 = this.x
      }

      return {
        x: x1,
        accepted: accepted
      }
    }

    // Adjustment
    _adjust (i) {
      this.proposal.update(i.accepted)
    }
  }

  /* class HMC extends MCMC {
      constructor(logDensity, dLogDensity, config, initialState) {
          super(logDensity, config, initialState);
      }
  } */

  // TODO rejection sampling with log-concave dist
  // TODO slice sampling
  // TODO Gibbs sampling
  // TODO NUTS
  // TODO adaptive Metropolis

  // TODO Hamiltonian
  // TODO Adjust Euclidean metric from covariance in burn-in
  // TODO step size sampled randomly

  // Public methods and classes
  return {
    gr: gr,
    // Slice: Slice,
    RWM: RWM
  }
})()
