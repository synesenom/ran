import Xoshiro128p from '../core/xoshiro'

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
    // See decisions/0004-validate-rejects-undefined-and-nan.md — comparison operators against undefined/null/NaN return false, so missing params would otherwise pass silently
    const missing = Object.entries(params)
      .filter(([, v]) => v === undefined || v === null || Number.isNaN(v))
      .map(([name]) => name)
    if (missing.length > 0) {
      throw Error(`Invalid parameters. Required parameters missing or not a number: ${missing.join(', ')}.`)
    }

    // Go through parameters and check constraints
    const errors = constraints.filter(constraint => {
      // Tokenize constraint
      let tokens = constraint.split(/ (<=|>=|!=) /)
      if (tokens.length === 1) {
        tokens = constraint.split(/ ([=<>]) /)
      }

      // Substitute parameters if there is any
      const a = Object.prototype.hasOwnProperty.call(params, tokens[0]) ? params[tokens[0]] : parseFloat(tokens[0])
      const b = Object.prototype.hasOwnProperty.call(params, tokens[2]) ? params[tokens[2]] : parseFloat(tokens[2])

      // Check for errors
      switch (tokens[1]) {
        case '<':
          return a >= b
        case '<=':
          return a > b
        case '>':
          return a <= b
        case '>=':
          return a < b
        case '!=':
          return a === b
        /* istanbul ignore next */
        default:
          return false
      }
    })

    if (errors.length > 0) {
      throw Error(`Invalid parameters. Parameters must satisfy the following constraints: ${constraints.join(', ')}. Got: ${Object.entries(params).map(([name, value]) => `${name} = ${value}`).join(', ')}`)
    }
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
}
