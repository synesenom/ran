/**
 * Calculates the [odds ratio]{@link https://en.wikipedia.org/wiki/Odds_ratio} for the joint probabilities of two binary
 * variables:
 *
 * $$OR(p_{00}, p_{01}, p_{10}, p_{11}) = \frac{p_{00} p_{11}}{p_{01} p_{10}}.$$
 *
 * @method oddsRatio
 * @memberof ran.dependence
 * @param {number} p00 The probability of X = 0 and Y = 0.
 * @param {number} p01 The probability of X = 0 and Y = 1.
 * @param {number} p10 The probability of X = 1 and Y = 0.
 * @param {number} p11 The probability of X = 1 and Y = 1.
 * @returns {number} The odds ratio. Returns Infinity when p01 or p10 is zero and the numerator is non-zero.
 * @example
 *
 * ran.dependence.oddsRatio(0.3, 0, 0.3, 0.4)
 * // => Infinity
 *
 * ran.dependence.oddsRatio(0.3, 0.3, 0, 0.4)
 * // => Infinity
 *
 * ran.dependence.oddsRatio(0.1, 0.2, 0.3, 0.4)
 * // => 0.6666666666666669
 */
export default function (p00, p01, p10, p11) {
  return p00 * p11 / (p01 * p10)
}
