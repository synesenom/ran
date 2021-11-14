/**
 * Calculates the sign function of a value.
 *
 * @method sign
 * @memberof ran.utils
 * @param {number} x Value to calculate sign for.
 * @return {number} 1 if the value is positive, -1 is it is negative, 0 otherwise.
 * @private
 */
export default function (x) {
  return x > 0 ? 1 : x < 0 ? -1 : 0
}
