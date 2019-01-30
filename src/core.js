import { r, some } from './utils'

/**
 * Core random generators and manipulators.
 *
 * @namespace core
 * @memberOf ran
 */

/**
   * Generates some uniformly distributed random floats in (min, max).
   * If min > max, a random float in (max, min) is generated.
   * If no parameters are passed, generates a single random float between 0 and 1.
   * If only min is specified, generates a single random float between 0 and min.
   *
   * @method float
   * @memberOf ran.core
   * @param {number=} min Lower boundary, or upper if max is not given.
   * @param {number=} max Upper boundary.
   * @param {number=} n Number of floats to generate.
   * @returns {(number|Array)} Single float or array of random floats.
   * @example
   *
   * ran.core.float()
   * // => 0.278014086611011
   *
   * ran.core.float(2)
   * // => 1.7201255276155272
   *
   * ran.core.float(2, 3)
   * // => 2.3693449236256185
   *
   * ran.core.float(2, 3, 5)
   * // => [ 2.4310443387740093,
   * //      2.934333354639414,
   * //      2.7689523358767127,
   * //      2.291137165632517,
   * //      2.5040591952427906 ]
   *
   */
export function float (min, max, n) {
  if (arguments.length === 0) { return Math.random() }
  if (arguments.length === 1) { return Math.random() * min }
  return some(() => r(min, max), n)
}

/**
   * Generates some uniformly distributed random integers in (min, max).
   * If min > max, a random integer in (max, min) is generated.
   * If only min is specified, generates a single random integer between 0 and min.
   *
   * @method int
   * @memberOf ran.core
   * @param {number} min Lower boundary, or upper if max is not specified.
   * @param {number=} max Upper boundary.
   * @param {number=} n Number of integers to generate.
   * @returns {(number|Array)} Single integer or array of random integers.
   * @example
   *
   * ran.core.int(10)
   * // => 2
   *
   * ran.core.int(10, 20)
   * //=> 12
   *
   * ran.core.int(10, 20, 5)
   * // => [ 12, 13, 10, 14, 14 ]
   *
   */
export function int (min, max, n) {
  if (arguments.length === 1) { return Math.floor(Math.random() * (min + 1)) }
  return some(() => Math.floor(r(min, max + 1)), n)
}

/**
   * Samples some elements with replacement from an array with uniform distribution.
   *
   * @method choice
   * @memberOf ran.core
   * @param {Array=} values Array to sample from.
   * @param {number=} n Number of elements to sample.
   * @returns {(object|Array)} Single element or array of sampled elements.
   * If array is invalid, null pointer is returned.
   * @example
   *
   * ran.core.choice([1, 2, 3, 4, 5])
   * // => 2
   *
   * ran.core.choice([1, 2, 3, 4, 5], 5)
   * // => [ 1, 5, 4, 4, 1 ]
   */
export function choice (values, n) {
  if (values === null || values === undefined || values.length === 0) { return null }
  return some(() => values[Math.floor(Math.random() * values.length)], n)
}

/**
   * Samples some characters with replacement from a string with uniform distribution.
   *
   * @method char
   * @memberOf ran.core
   * @param {string=} string String to sample characters from.
   * @param {number=} n Number of characters to sample.
   * @returns {(string|Array)} Random character if n is not given or less than 2, an array of random characters
   * otherwise. If string is empty, null is returned.
   * @example
   *
   * ran.core.char('abcde')
   * // => 'd'
   *
   * ran.core.char('abcde', 5)
   * // => [ 'd', 'c', 'a', 'a', 'd' ]
   *
   */
export function char (string, n) {
  if (string === null || string === undefined || string.length === 0) { return null }
  return some(() => string.charAt(Math.floor(Math.random() * string.length)), n)
}

/**
   * Shuffles an array in-place using the Fisher--Yates algorithm.
   *
   * @method shuffle
   * @memberOf ran.core
   * @param {Array} values Array to shuffle.
   * @returns {Array} The shuffled array.
   * @example
   *
   * ran.core.shuffle([1, 2, 3])
   * // => [ 2, 3, 1 ]
   *
   */
export function shuffle (values) {
  let i; let tmp; let l = values.length
  while (l) {
    i = Math.floor(Math.random() * l--)
    tmp = values[l]
    values[l] = values[i]
    values[i] = tmp
  }
  return values
}

/**
   * Flips a biased coin several times and returns the associated head/tail value or array of values.
   *
   * @method coin
   * @memberOf ran.core
   * @param {object} head Head value.
   * @param {object} tail Tail value.
   * @param {number=} p Bias (probability of head). Default is 0.5.
   * @param {number=} n Number of coins to flip. Default is 1.
   * @returns {(object|Array)} Single head/tail value or an array of head/tail values.
   * @example
   *
   * ran.core.coin('a', {b: 2})
   * // => { b: 2 }
   *
   * ran.core.coin('a', {b: 2}, 0.9)
   * // => 'a'
   *
   * ran.core.coin('a', {b: 2}, 0.9, 9)
   * // => [ { b: 2 }, 'a', 'a', 'a', 'a', 'a', 'a', { b: 2 }, 'a' ]
   */
export function coin (head, tail, p = 0.5, n = 1) {
  return some(() => Math.random() < p ? head : tail, n)
}
