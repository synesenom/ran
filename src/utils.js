/**
 * Module containing some hidden utility functions.
 *
 * @module utils
 * @memberOf ran
 * @private
 */

/**
 * Runs a generator once or several times to return a single value or an array of values.
 *
 * @method some
 * @memberOf ran.utils
 * @param {function} generator Random generator to use.
 * @param {number=} k Number of values to generate.
 * @returns {(number|string|Array)} Single value or array of generated values.
 * @private
 */
export function some (generator, k = 1) {
  if (k < 2) {
    return generator()
  } else {
    return Array.from({ length: k }, () => generator())
  }
}
