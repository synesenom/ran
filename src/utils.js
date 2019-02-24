/**
 * Module containing some hidden utility functions.
 *
 * @module utils
 * @memberOf ran
 * @private
 */

/**
 * Sums the element of an array.
 *
 * @method sum
 * @memberOf ran.utils.
 * @param {number[]} arr Array of numbers to sum over.
 * @param {number=} pow Power to raise each element before summing up.
 * @returns {number} The sum of the elements in the array.
 * @private
 */


/**
 * The main random number generator.
 *
 * @method r
 * @memberOf ran.utils
 * @param {number} min Lower boundary.
 * @param {number} max Upper boundary.
 * @returns {number} Random number.
 * @private
 */
export function r (min, max) {
  return Math.random() * (max - min) + min
}

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
