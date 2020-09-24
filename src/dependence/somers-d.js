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
 * @returns {(number|undefined)} Somers' D if none of the arrays are empty, they have the same length, undefined
 * otherwise.
 * @example
 *
 * ran.dependence.somersD([], [])
 * // => undefined
 *
 * ran.dependence.somersD([1, 2, 3], [1, 2, 3, 4])
 * // => undefined
 *
 * ran.dependence.somersD([1, 2, 3], [4, 6, 6])
 * // => 0.6666666666666666
 *
 * ran.dependence.somersD([1, 1, 0], [4, 5, 6])
 * // => -1
 */
export default function (x, y) {
  if (x.length === 0 || y.length === 0 || x.length !== y.length) {
    return undefined
  }

  return tau(x, y) / tau(x, x)
}
