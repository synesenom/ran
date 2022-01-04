import neumaier from '../algorithms/neumaier'

function _log (base) {
  const logBase = typeof base === 'undefined' ? 1 : Math.log(base)
  return x => Math.log(x) / logBase
}

/**
 * Calculates the [Shannon entropy]{@link https://en.wikipedia.org/wiki/Entropy_(information_theory)} for a probability
 * distribution.
 *
 * @method entropy
 * @memberof ran.dispersion
 * @param {number[]} probabilities Array representing the probabilities for the i-th value.
 * @param {number=} base Base for the logarithm. If not specified, natural logarithm is used.
 * @returns {(number|undefined)} Entropy of the probabilities if there are any, undefined otherwise.
 * @example
 *
 * ran.dispersion.entropy([])
 * // => undefined
 *
 * ran.dispersion.entropy([0.1, 0.1, 0.8])
 * // => 0.639031859650177
 *
 * ran.dispersion.entropy([0.3, 0.3, 0.4])
 * // => 1.0888999753452238
 */
export default function (probabilities, base) {
  if (probabilities.length === 0) {
    return undefined
  }

  // Create logarithm using the specified base.
  const logFunc = _log(base)

  // Return the sum using the accurate Neumaier summation.
  return -neumaier(probabilities.map(d => d * logFunc(d)))
}
