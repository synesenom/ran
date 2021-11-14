import logGamma from './log-gamma'

/**
 * Beta function.
 *
 * @method beta
 * @memberof ran.special
 * @param {number} x First argument.
 * @param {number} y Second argument.
 * @returns {number} The value of the beta function.
 * @private
 */
export default function (x, y) {
  return Math.exp(logGamma(x) + logGamma(y) - logGamma(x + y))
}
