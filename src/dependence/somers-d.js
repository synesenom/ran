import concordant from '../utils/concordant'
import discordant from '../utils/discordant'

function tau (a, b) {
  return (concordant(a, b) - discordant(a, b)) / (a.length * (a.length - 1))
}

/**
 * Calculates [Somers' D]{@link https://en.wikipedia.org/wiki/Somers%27_D} for paired arrays of values.
 *
 * @method somersD
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {number} Somers' D, or NaN for empty arrays. Throws if arrays have different lengths.
 * @example
 *
 * ran.dependence.somersD([], [])
 * // => NaN
 *
 * ran.dependence.somersD([1, 2, 3], [4, 6, 6])
 * // => 0.6666666666666666
 *
 * ran.dependence.somersD([1, 1, 0], [4, 5, 6])
 * // => -1
 */
export default function (x, y) {
  if (x.length !== y.length) {
    throw Error('Arrays must have the same length')
  }
  if (x.length === 0) {
    return NaN
  }

  return tau(x, y) / tau(x, x)
}
