import logGamma from './log-gamma'

/**
 * Logarithm of the beta function.
 *
 * @method logBeta
 * @methodOf ran.special
 * @param {number} x First argument.
 * @param {number} y Second argument.
 * @returns {number} The logarithm of the beta function.
 * @private
 */
export default function (x, y) {
  return logGamma(x) + logGamma(y) - logGamma(x + y)
}
