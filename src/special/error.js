import { gammaLowerIncomplete } from './gamma-incomplete'

/**
   * Error function.
   *
   * @method erf
   * @memberOf ran.special
   * @param {number} x Value to evaluate the error function at.
   * @returns {number} Error function value.
   * @private
   */
export default function (x) {
  return x < 0
    ? -gammaLowerIncomplete(0.5, x * x)
    : gammaLowerIncomplete(0.5, x * x)
}
