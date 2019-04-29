import { EPS, MAX_ITER } from '../special/_core'

/**
 * Class implementing a recursive sum. It is initialized with the zeroth term of the sum, an updater for the term variables and a method that computes the term from the variables.
 *
 * @class RecursiveSum
 * @memberOf ran.algorithms
 * @param {number[]} x0 Array containing the state of the variables in the zeroth index.
 * @param {Function} updater Function that takes the current state of the variables, the current index and returns the next state of the variables.
 * @param {Function} deltaFn Function that takes the current state of the variables and returns the term corresponding to the state.
 * @private
 */
export default class {
  constructor (x0, updater, deltaFn) {
    this.x = x0
    this.updater = updater
    this.deltaFn = deltaFn

    // Init delta and sum
    this.delta = deltaFn(x0)
    this.sum = this.delta
  }

  // Iterator
  _next (i) {
    // Update counter and variables
    this.xx = this.updater(this.x, i)

    // Update delta and sum
    this.delta = this.deltaFn(this.x)
    this.sum += this.delta
  }

  /**
   * Computes the recursive sum. Iterates until the maximum number of iterations has reached or the accuracy dropped below the specified value.
   *
   * @method compute
   * @methodOf ran.algorithms.RecursiveSum
   * @return {(number|undefined)} The sum if it can be computed, or undefined if maximum number of iterations has reached.
   */
  compute () {
    for (let i = 1; i < MAX_ITER; i++) {
      this._next(i)
      if (Math.abs(this.delta / this.sum) < EPS) {
        return this.sum
      }
    }
    return undefined
  }
}