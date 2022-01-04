/**
 * Clamps a value between a specific range.
 *
 * @method clamp
 * @memberof ran.utils
 * @param {number} x Value to clamp.
 * @param {number=} a Lower bound of the clamping range. Default value is 0.
 * @param {number=} b Upper bound of the clamping range. Default value is 1.
 * @return {number} The clamped value.
 * @private
 */
export default function (x, a = 0, b = 1) {
  return Math.max(a, Math.min(b, x))
}
