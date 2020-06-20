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

    // Call next once.
    this.next()
  }

  /**
   * Generates a has for a string, based on the Java String.hashCode implementation.
   *
   * @method hash
   * @methodOf ran.core.Xoshiro128p
   * @param {string} str String to hash.
   * @returns {number} The hash code.
   */
  static hash (str) {
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
  next () {
    // Init helper variables
    const t = this._state[1] << 9
    const u = this._state[0] + this._state[3]

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
  seed (value) {
    // Set state
    this._state = [
      (typeof value === 'number' ? value : Xoshiro128p.hash(value)) >>> 0,
      2, 3, 4
    ]

    // Run some iterations
    for (let i = 0; i < 100; i++) {
      this.next()
    }
  }

  /**
   * Loads the state of the generator.
   *
   * @method load
   * @methodOf ran.core.Xoshiro128p
   * @param {number[]} state The state to load.
   */
  load (state) {
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
  save () {
    return this._state
  }
}

export default Xoshiro128p
