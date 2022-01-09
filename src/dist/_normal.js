/**
 * Generates a normally distributed random variate.
 *
 * @method normal
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} mu Distribution mean. Default value is 0.
 * @param {number=} sigma Distribution standard deviation. Default value is 1.
 * @returns {number} Random variate.
 * @ignore
 */
export default function (r, mu = 0, sigma = 1) {
  const u = r.next()

  const v = r.next()
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mu
}
