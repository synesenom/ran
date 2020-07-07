import { neumaier } from '../algorithms'

function log (base) {
  const logBase = typeof base === 'undefined' ? 1 : Math.log(base)
  return x => Math.log(x) / logBase
}

/**
 * Calculates the [Shannon entropy]{@link https://en.wikipedia.org/wiki/Entropy_(information_theory)} of an array of
 * values.
 *
 * @method entropy
 * @memberOf ran.dispersion
 * @param {number[]} values Array of values to calculate entropy for.
 * @returns {(number|undefined)} Entropy of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.dispersion.entropy([])
 * // => undefined
 *
 * ran.dispersion.entropy([0, 1])
 * // => 0.6931471805599453
 *
 * ran.dispersion.entropy([0, 1], 2)
 * // => 1
 *
 * ran.dispersion.entropy([0, 1, 2, 3])
 * // => 1.3862943611198906
 *
 * ran.dispersion.entropy([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 10)
 * // => 0.6020599913279623
 */
export default function (values, base) {
  if (values.length === 0) {
    return undefined
  }

  // Create logarithm using the specified base.
  const logFunc = log(base)

  // Calculate p log(p) values
  const p = Array.from(values.reduce((acc, d) => acc.set(d, (acc.get(d) || 0) + 1), new Map()).values())
    .map(d => d * logFunc(d))

  // Return the sum using the accurate Neumaier summation.
  return logFunc(values.length) - neumaier(p) / values.length
}
