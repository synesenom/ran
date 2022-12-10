/**
 * Generates a exponential random variate.
 *
 * @method exponential
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} lambda Rate parameter.
 * @returns {number} Random variate.
 * @ignore
 */
export default function (r, lambda) {
  return -Math.log(r.next()) / lambda
}
