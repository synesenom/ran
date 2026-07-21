/**
 * Generates a exponential random variate.
 *
 * @method exponential
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} lambda Rate parameter.
 * @returns {number} Random variate.
 * @ignore
 */
export default function (r, lambda = 1) {
  // r.next() is uniform on [0, 1) and can return exactly 0 (~1-in-2^32 per call), which would
  // make Math.log(0) = -Infinity and leak an Infinity sample. 1 - r.next() is uniform on
  // (0, 1] instead, so the argument to log() is never exactly 0.
  return -Math.log(1 - r.next()) / lambda
}
