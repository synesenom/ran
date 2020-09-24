import concordant from '../utils/concordant'
import discordant from '../utils/discordant'

/**
 * Calculates [Goodman-Kruskal gamma]{@link https://en.wikipedia.org/wiki/Goodman_and_Kruskal%27s_gamma} for paired
 * arrays of values.
 *
 * @method goodmanKruskalGamma
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} The Goodman-Kruskal gamma if none of the arrays are empty and they have the same
 * length, undefined otherwise.
 * TODO @example
 */
export default function (x, y) {
  if (x.length === 0 || y.length === 0 || x.length !== y.length) {
    return undefined
  }

  const ns = concordant(x, y)
  const nd = discordant(x, y)
  return (ns - nd) / (ns + nd)
}
