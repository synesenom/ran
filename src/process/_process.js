import Xoshiro128p from '../core/xoshiro'
import validateParams from '../utils/validate-params'
import neumaier from '../algorithms/neumaier'

/**
 * The stochastic process generator base class, all process generators extend this class. The methods listed here
 * are available for all process generators.
 *
 * @class Process
 * @memberof ran.process
 */
export default class Process {
  constructor () {
    if (new.target === Process) {
      throw Error('Process is abstract and cannot be instantiated directly.')
    }

    // Parameters — subclass populates after super()
    /** @type {Object} */
    this.p = {}

    // Current state — subclass sets after super()
    this.x = null

    // Initial state — subclass sets after super(); used by reset()
    this.x0 = null

    // Pseudo random number generator
    this.r = new Xoshiro128p()

    // Speed-up constants — must be a named object, never a positional array
    // decisions/0008-this-c-named-object-convention.md
    this.c = {}
  }

  /**
   * Returns the parameters of the process.
   *
   * @method params
   * @memberof ran.process.Process
   * @returns {Object} The parameters of the process.
   */
  params () {
    return this.p
  }

  /**
   * Seeds the internal PRNG for reproducible paths.
   *
   * @method seed
   * @memberof ran.process.Process
   * @param {number|string} value Seed value passed to the underlying Xoshiro128p PRNG.
   * @returns {this} Reference to the current process.
   */
  seed (value) {
    this.r.seed(value)
    return this
  }

  /**
   * Returns the analytical covariogram (covariance function) of the process evaluated at times
   * s and t. Must be implemented by subclasses.
   *
   * @method covariogram
   * @memberof ran.process.Process
   * @param {number} s First time point.
   * @param {number} t Second time point.
   * @returns {number} Covariance between the process values at times s and t.
   */
  covariogram (s, t) { // eslint-disable-line no-unused-vars
    throw Error('Process.covariogram() is not implemented')
  }

  /**
   * Returns the analytical mean of the process at time t. Must be implemented by subclasses.
   *
   * @method mean
   * @memberof ran.process.Process
   * @param {number} t Time.
   * @returns {number} Expected value at time t, or NaN for t < 0.
   */
  mean (t) { // eslint-disable-line no-unused-vars
    throw Error('Process.mean() is not implemented')
  }

  /**
   * Returns the analytical variance of the process at time t. Must be implemented by subclasses.
   *
   * @method variance
   * @memberof ran.process.Process
   * @param {number} t Time.
   * @returns {number} Variance at time t, or NaN for t < 0.
   */
  variance (t) { // eslint-disable-line no-unused-vars
    throw Error('Process.variance() is not implemented')
  }

  /**
   * Returns the marginal probability density or mass at state x and time t. For continuous
   * processes this is a probability density; for discrete processes (e.g. Poisson) this is
   * a probability mass. Must be implemented by subclasses.
   *
   * @method pdf
   * @memberof ran.process.Process
   * @param {number} x State value.
   * @param {number} t Time.
   * @returns {number} Marginal density or mass at (x, t), or NaN when t is out of domain.
   */
  pdf (x, t) { // eslint-disable-line no-unused-vars
    throw Error('Process.pdf() is not implemented')
  }

  /**
   * Returns the marginal distribution of the process at time t as a fully-functional
   * Distribution instance, unlocking the entire Distribution API (quantile, hazard, survival,
   * likelihood, aic, bic, test) on the marginal without additional numerical machinery. Must be
   * implemented by subclasses.
   *
   * decisions/0040-process-marginal-distribution-instance.md — returns an existing Distribution
   * instance built from already-derived mean()/variance()/pdf() parameters, instead of
   * duplicating Distribution's numerical machinery on Process.
   *
   * @method marginal
   * @memberof ran.process.Process
   * @param {number} t Time.
   * @returns {import('../dist/_distribution').default} Distribution instance representing the marginal at time t.
   * @throws {Error} If not implemented by the subclass, or if t is outside the process's domain.
   */
  marginal (t) { // eslint-disable-line no-unused-vars
    throw Error('Process.marginal() is not implemented')
  }

  /**
   * Returns the log-likelihood of an observed discrete-time path under this process's
   * one-step transition density, i.e. the sum over consecutive pairs of
   * log(f(x_{i+1} | x_i)), where f is the transition density implemented by
   * _transitionLnPdf(). This treats path as one dependent, Markov-correlated trajectory,
   * not a set of independent draws from the marginal distribution — the two are different
   * objects (decisions/0046-process-lnl-transition-likelihood.md) and only the transition
   * form is the correct likelihood for a single realized path.
   *
   * @method lnL
   * @memberof ran.process.Process
   * @param {Array} path Array of observed states (e.g. as returned by path()), spaced dt apart.
   * @returns {number} The transition log-likelihood of the path.
   * @throws {Error} If path has fewer than 2 states, or if the subclass has no closed-form
   * transition density.
   */
  lnL (path) {
    if (!Array.isArray(path) || path.length < 2) {
      throw Error('Process.lnL(): path must contain at least 2 states')
    }
    const terms = []
    for (let i = 0; i < path.length - 1; i++) {
      terms.push(this._transitionLnPdf(path[i], path[i + 1]))
    }
    return neumaier(terms)
  }

  /**
   * Advances the process by one step, updates the current state, and returns the new state.
   *
   * @method next
   * @memberof ran.process.Process
   * @returns {number} The new state after the step.
   */
  next () {
    this.x = this._next()
    return this.x
  }

  /**
   * Generates a path of n steps starting from the initial state. Advances the PRNG stream by n
   * steps (like sample()), so consecutive calls return independent realizations. The process
   * state is restored to its pre-call value after generation.
   *
   * @method path
   * @memberof ran.process.Process
   * @param {number} n Number of steps.
   * @returns {Array} Array of n+1 states (initial state followed by n successive states).
   */
  path (n) {
    const states = [this.x0]
    const savedX = this.x
    this.x = this.x0
    for (let i = 0; i < n; i++) {
      this.x = this._next()
      states.push(this.x)
    }
    this.x = savedX
    return states
  }

  /**
   * Generates m independent paths of n steps each by calling path(n) m times.
   *
   * @method ensemble
   * @memberof ran.process.Process
   * @param {number} m Number of paths.
   * @param {number} n Number of steps per path.
   * @returns {Array} Array of m arrays, each of length n+1 (initial state followed by n states).
   */
  ensemble (m, n) {
    Process.validate({ m, n }, ['m >= 1', 'n >= 1'])
    const paths = []
    for (let i = 0; i < m; i++) {
      paths.push(this.path(n))
    }
    return paths
  }

  /**
   * Resets the process to its initial state.
   *
   * @method reset
   * @memberof ran.process.Process
   */
  reset () {
    this.x = this.x0
  }

  /**
   * Returns the current state of the process.
   *
   * @method state
   * @memberof ran.process.Process
   * @returns {number} Current state.
   */
  state () {
    return this.x
  }

  /**
   * Validates a set of parameters using a list of constraints.
   *
   * @method validate
   * @memberof ran.process.Process
   * @param {Object} params Object containing the parameters to validate.
   * @param {string[]} constraints Array of strings defining the parameter constraints.
   * @throws {Error} If any parameter is undefined, null, or NaN, or doesn't satisfy the constraints.
   * @ignore
   */
  static validate (params, constraints) {
    validateParams(params, constraints)
  }

  /**
   * Estimates process parameters from an observed discrete-time path and returns a new,
   * calibrated instance of the concrete subclass. Must be implemented by subclasses.
   *
   * Static rather than an instance method (unlike the analytical hooks above): fit() is a
   * factory that builds a new instance from data, with no existing instance to query — the
   * same shape as ran.dist.Distribution.static fit(data) — decisions/0044-process-fit-static-factory.md.
   *
   * @method fit
   * @memberof ran.process.Process
   * @param {Array} path Array of observed states (e.g. as returned by path()).
   * @param {number} [dt=1] Time step between consecutive path observations (must be > 0).
   * @returns {Process} A new instance of the concrete subclass with estimated parameters.
   * @throws {Error} If not implemented by the subclass, or if path/dt are invalid for the estimator.
   */
  static fit (path, dt) { // eslint-disable-line no-unused-vars
    throw Error('Process.fit() is not implemented')
  }

  /**
   * Generates the next state. Must be implemented by subclasses.
   *
   * @method _next
   * @memberof ran.process.Process
   * @returns {number} Next state.
   * @protected
   * @ignore
   */
  _next () {
    throw Error('Process._next() is not implemented')
  }

  /**
   * Returns the log-density of the one-step transition from xPrev to xNext. Must be
   * implemented by subclasses with a closed-form transition density.
   *
   * @method _transitionLnPdf
   * @memberof ran.process.Process
   * @param {number} xPrev State at the start of the step.
   * @param {number} xNext State at the end of the step.
   * @returns {number} Log-density of the transition xPrev -> xNext.
   * @protected
   * @ignore
   */
  _transitionLnPdf (xPrev, xNext) { // eslint-disable-line no-unused-vars
    throw Error('Process._transitionLnPdf() is not implemented')
  }
}
