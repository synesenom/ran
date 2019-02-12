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
export function sum (arr, pow = 1) {
  if (pow !== 1) {
    return arr.reduce((sum, d) => {
      return sum + Math.pow(d, pow)
    }, 0)
  } else {
    return arr.reduce((sum, d) => {
      return sum + d
    }, 0)
  }
}

/**
 * Sums the element of an array using the robust (but slower) [Neumaier method]{@link https://www.mat.univie.ac.at/~neum/scan/01.pdf}.
 *
 * @method neumaier
 * @memberOf ran.utils.
 * @param {number[]} arr Array to sum.
 * @returns {number} The sum of the elements in the array.
 */
export function neumaier (arr) {
  let s = arr[0]
  let c = 0
  for (let i = 1; i < arr.length; i++) {
    let t = s + arr[i]
    if (Math.abs(s) > Math.abs(arr[i])) {
      c += (s - t) + arr[i]
    } else {
      c += (arr[i] - t) + s
    }
    s = t
  }
  return s + c
}

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
