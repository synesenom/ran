import gammaLn from './gamma-log'

/**
 * Computes the logarithm of the binomial coefficient for two numbers.
 *
 * @method binomLn
 * @memberOf ran.special
 * @param {number} n Number of samples.
 * @param {number} k Number of draws
 * @return {number} The logarithm of the binomial coefficient.
 * @private
 */
export default function (n, k) {
  return gammaLn(n + 1) - gammaLn(k + 1) - gammaLn(n - k + 1)
}
