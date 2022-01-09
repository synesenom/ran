import gamma from './_gamma'

/**
 * Generates a chi2 random variate.
 *
 * @method chi2
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} nu Degrees of freedom.
 * @returns {number} Random variate.
 * @ignore
 */
export default function (r, nu) {
  return gamma(r, nu / 2, 0.5)
}
