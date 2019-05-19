import { some } from './utils'

/**
 * Core random generators and manipulators.
 *
 * @namespace core
 * @memberOf ran
 */

/**
 * A xoshiro128+ pseudo random number generator.
 *
 * @class Xoshiro128p
 * @memberOf ran.core
 * @private
 */
class Xoshiro128p {
  constructor (state) {
    // Set state
    this._state = state || [
      (Math.random() * Number.MAX_SAFE_INTEGER) >>> 0,
      2, 3, 4
    ]
  }

  /**
   * Generates a has for a string, based on the Java String.hashCode implementation.
   *
   * @method hash
   * @methodOf ran.core.Xoshiro128p
   * @param {string} str String to hash.
   * @returns {number} The hash code.
   */
  static hash(str) {
    // Calculate Java's String.hashCode value
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return hash
  }

  /**
   * Returns the next pseudo random number.
   *
   * @method next
   * @methodOf ran.core.Xoshiro128p
   * @returns {number} The next pseudo random number.
   */
  next() {
    // Init helper variables
    let t = this._state[1] << 9
    let u = this._state[0] + this._state[3]

    // Update state
    this._state[2] = this._state[2] ^ this._state[0]
    this._state[3] = this._state[3] ^ this._state[1]
    this._state[1] = this._state[1] ^ this._state[2]
    this._state[0] = this._state[0] ^ this._state[3]
    this._state[2] = this._state[2] ^ t
    this._state[3] = this._state[3] << 11 | this._state[3] >>> 21

    // Return random number
    return (u >>> 0) / 4294967296
  }

  /**
   * Sets the seed for the underlying pseudo random number generator used by ranjs. Under the hood, ranjs
   * implements the [xoshiro128+ algorithm]{@link http://vigna.di.unimi.it/ftp/papers/ScrambledLinear.pdf}.
   *
   * @method seed
   * @methodOf ran.core.Xoshiro128p
   * @param {(number|string)} value The value of the seed, either a number or a string (for the ease of tracking
   * seeds).
   */
  seed(value) {
    // Set state
    this._state = [
      (typeof value === 'number' ? value : Xoshiro128p.hash(value)) >>> 0,
      2, 3, 4
    ]

    // Run some iterations
    for (let i = 0; i < 100; i++) {
      this.next();
    }
  }

  /**
   * Loads the state of the generator.
   *
   * @method load
   * @methodOf ran.core.Xoshiro128p
   * @param {number[]} state The state to load.
   */
  load(state) {
    this._state = state
  }

  /**
   * Returns the current state of the generator. This can be later passed on to a new generator to continue where the
   * current one finished.
   *
   * @method save
   * @methodOf ran.core.Xoshiro128p
   * @returns {number[]} The current state of the generator.
   */
  save() {
    return this._state
  }
}

// Export class as well
export { Xoshiro128p }

// The internal generator of the core
const r = new Xoshiro128p()

/**
 * Sets the seed for the underlying pseudo random number generator used by the core generators. Under the hood, ranjs
 * implements the [xoshiro128+ algorithm]{@link http://vigna.di.unimi.it/ftp/papers/ScrambledLinear.pdf}.
 *
 * @method seed
 * @memberOf ran.core
 * @param {(number|string)} value The value of the seed, either a number or a string (for the ease of tracking seeds).
 */
export const seed = value => r.seed(value)

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
 * @returns {(number|number[])} Single float or array of random floats.
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
  if (arguments.length === 0) { return r.next() }
  if (arguments.length === 1) { return r.next() * min }
  return some(() => r.next() * (max - min) + min, n)
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
 * @returns {(number|number[])} Single integer or array of random integers.
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
  if (arguments.length === 1) { return Math.floor(r.next() * (min + 1)) }
  return some(() => Math.floor(r.next() * (max - min + 1) + min), n)
}

/**
 * Samples some elements with replacement from an array with uniform distribution.
 *
 * @method choice
 * @memberOf ran.core
 * @param {Array=} values Array to sample from.
 * @param {number=} n Number of elements to sample.
 * @returns {(object|object[])} Single element or array of sampled elements.
 * If array is invalid, undefined is returned.
 * @example
 *
 * ran.core.choice([1, 2, 3, 4, 5])
 * // => 2
 *
 * ran.core.choice([1, 2, 3, 4, 5], 5)
 * // => [ 1, 5, 4, 4, 1 ]
 */
export function choice (values, n) {
  if (!values) {
    return undefined
  }
  return some(() => values[Math.floor(r.next() * values.length)], n)
}

/**
 * Samples some characters with replacement from a string with uniform distribution.
 *
 * @method char
 * @memberOf ran.core
 * @param {string=} string String to sample characters from.
 * @param {number=} n Number of characters to sample.
 * @returns {(string|string[])} Random character if n is not given or less than 2, an array of random characters
 * otherwise. If string is empty, undefined is returned.
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
  if (!string) {
    return undefined
  }
  return some(() => string.charAt(Math.floor(r.next() * string.length)), n)
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
    i = Math.floor(r.next() * l--)
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
 * @returns {(object|object[])} Single head/tail value or an array of head/tail values.
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
  return some(() => r.next() < p ? head : tail, n)
}
