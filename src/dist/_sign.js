/**
 * Generates a random sign.
 *
 * @method sign
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} p Probability of +1. Default value is 0.5.
 * @return {number} Random sign (-1 or +1).
 * @ignore
 */
export default function (r, p = 0.5) {
  return r.next() < p ? 1 : -1
}
