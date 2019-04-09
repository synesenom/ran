import gammaLn from './gamma-log'

/**
 * Beta function.
 *
 * @method beta
 * @methodOf ran.special
 * @param {number} x First argument.
 * @param {number} y Second argument.
 * @returns {number} The value of the beta function.
 * @private
 */
export default function (x, y) {
  return Math.exp(gammaLn(x) + gammaLn(y) - gammaLn(x + y))
}
