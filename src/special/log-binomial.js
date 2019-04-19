import logGamma from './log-gamma'

/**
 * Computes the logarithm of the binomial coefficient for two numbers.
 *
 * @method logBinomial
 * @memberOf ran.special
 * @param {number} n Number of samples.
 * @param {number} k Number of draws
 * @return {number} The logarithm of the binomial coefficient.
 * @private
 */
export default function (n, k) {
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1)
}
