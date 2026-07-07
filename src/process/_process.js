import Xoshiro128p from '../core/xoshiro'

/**
 * The stochastic process generator base class, all process generators extend this class.
 *
 * @class Process
 * @memberof ran.process
 * @constructor
 */
export default class Process {
  constructor () {
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
   * @returns {*} Next state.
   * @protected
   * @ignore
   */
  _next () {
    throw Error('Process._next() is not implemented')
  }

  /**
   * Advances the process by one step, updates the current state, and returns the new state.
   *
   * @method next
   * @memberof ran.process.Process
   * @returns {*} The new state after the step.
   */
  next () {
    this.x = this._next()
    return this.x
  }

  /**
   * Generates a path of n steps starting from the initial state. Non-destructive: the current
   * state is preserved after the call.
   *
   * @method path
   * @memberof ran.process.Process
   * @param {number} n Number of steps.
   * @returns {Array} Array of n+1 states (initial state followed by n successive states).
   */
  path (n) {
    const states = [this.x0]
    const savedX = this.x
    const savedRng = this.r.save()
    this.x = this.x0
    for (let i = 0; i < n; i++) {
      this.x = this._next()
      states.push(this.x)
    }
    // restore — path() is non-destructive (state and PRNG)
    // See solutions/correctness/2026-07-07-1500-path-prng-save-restore.md
    this.r.load(savedRng)
    this.x = savedX
    return states
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
   * @returns {*} Current state.
   */
  state () {
    return this.x
  }
}
