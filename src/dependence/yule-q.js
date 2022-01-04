import oddsRatio from '../dependence/odds-ratio'

/**
 * Calculates [Yule's Q]{@link https://en.wikipedia.org/wiki/Goodman_and_Kruskal%27s_gamma#Yule's_Q} for the joint
 * probabilities of two binary variables:
 *
 * $$Q(p_{00}, p_{01}, p_{10}, p_{11}) = \frac{p_{00} p_{11} - p_{01} p_{10}}{p_{00} p_{11} + p_{01} p_{10}}.$$
 *
 * @method yuleQ
 * @memberof ran.dependence
 * @param {number} p00 The probability of X = 0 and Y = 0.
 * @param {number} p01 The probability of X = 0 and Y = 1.
 * @param {number} p10 The probability of X = 1 and Y = 0.
 * @param {number} p11 The probability of X = 1 and Y = 1.
 * @returns {(number|undefined)} Yule's Q if p01 and p10 are positive, undefined otherwise.
 * @example
 *
 * ran.dependence.yuleQ(0.3, 0, 0.3, 0.4)
 * // => undefined
 *
 * ran.dependence.yuleQ(0.3, 0.3, 0, 0.4)
 * // => undefined
 *
 * ran.dependence.yuleQ(0.1, 0.2, 0.3, 0.4)
 * // => -0.19999999999999984
 */
export default function (p00, p01, p10, p11) {
  const or = oddsRatio(p00, p01, p10, p11)
  if (typeof or === 'undefined') {
    return undefined
  }

  return (or - 1) / (or + 1)
}
