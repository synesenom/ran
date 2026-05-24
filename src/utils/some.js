/**
 * Runs a generator once or several times to return a single value or an array of values.
 *
 * @method some
 * @memberof ran.utils
 * @param {Function} generator Random generator to use.
 * @param {number=} k Number of values to generate.
 * @returns {(number|string|Array)} Single value or array of generated values.
 * @private
 */
export default function (generator, k = 1) {
  if (k < 2) {
    return generator()
  }
  const result = new Array(k)
  for (let i = 0; i < k; i++) {
    result[i] = generator()
  }
  return result
}
