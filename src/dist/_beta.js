import gamma from './_gamma'

/**
 * Generates a beta distributed random variate.
 *
 * @method normal
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} a First shape parameter.
 * @param {number=} b Second shape parameter.
 * @returns {number} Random variate.
 * @ignore
 */
export default function (r, a, b) {
  const x = gamma(r, a, 1)
  const y = gamma(r, b, 1)
  const z = x / (x + y)

  // Handle 1 - z << 1 case
  return Math.abs(1 - z) < Number.EPSILON ? 1 - y / x : z
}
