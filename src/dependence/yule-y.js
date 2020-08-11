import { oddsRatio } from '../dependence'

/**
 * Calculates [Yule's Y]{@link https://en.wikipedia.org/wiki/Coefficient_of_colligation} for the joint probabilities of
 * two binary variables:
 *
 * $$Y(p_{00}, p_{01}, p_{10}, p_{11}) = \frac{\sqrt{p_{00} p_{11}} - \sqrt{p_{01} p_{10}}}{\sqrt{p_{00} p_{11}} + \sqrt{p_{01} p_{10}}}.$$
 *
 * Probabilities don't need to sum to 1.
 *
 * @method yuleY
 * @methodOf ran.dependence
 * @param {number} p00 The probability of X = 0 and Y = 0.
 * @param {number} p01 The probability of X = 0 and Y = 1.
 * @param {number} p10 The probability of X = 1 and Y = 0.
 * @param {number} p11 The probability of X = 1 and Y = 1.
 * @returns {(number|undefined)} Yule's Y if p01 and p10 are positive, undefined otherwise.
 * @example
 *
 * ran.dependence.yuleY(0.3, 0, 0.3, 0.4)
 * // => undefined
 *
 * ran.dependence.yuleY(0.3, 0.3, 0, 0.4)
 * // => undefined
 *
 * ran.dependence.yuleY(0.1, 0.2, 0.3, 0.4)
 * // => -0.10102051443364372
 */
export default function (p00, p01, p10, p11) {
  const or = oddsRatio(p00, p01, p10, p11)
  if (typeof or === 'undefined') {
    return undefined
  }

  const sqrtOr = Math.sqrt(or)
  return (sqrtOr - 1) / (sqrtOr + 1)
}
