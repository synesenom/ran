import neumaier from '../algorithms/neumaier'

/**
 * Calculates the (discrete) [Kullback-Leibler divergence]{@link https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence}
 * for two probability distributions:
 *
 * $$D\_\mathrm{KL}(P \parallel Q) = \sum\_{x \in \mathcal{X}} P(x) \log\bigg(\frac{P(x)}{Q(x)}\bigg).$$
 *
 * @method kullbackLeibler
 * @memberof ran.dependence
 * @param {number[]} p Array representing the probabilities for the i-th value in the base distribution (P).
 * @param {number[]} q Array representing the probabilities for the i-th value in compared distribution (Q).
 * @throws {Error} If the arrays have different lengths.
 * @returns {number} The Kullback-Leibler divergence, NaN for empty input, Infinity if Q(x) = 0 and P(x) > 0 for
 * some x.
 * @example
 *
 * ran.dependence.kullbackLeibler([], [])
 * // => NaN
 *
 * ran.dependence.kullbackLeibler([0.1, 0.2, 0.7], [0, 0.3, 0.7])
 * // => Infinity
 *
 * ran.dependence.kullbackLeibler([0.1, 0.3, 0.6], [0.333, 0.333, 0.334])
 * // => 0.19986796234715937
 *
 * ran.dependence.kullbackLeibler([0.333, 0.333, 0.334], [0.1, 0.3, 0.6])
 * // => 0.2396882491444514
 */
export default function (p, q) {
  if (p.length !== q.length) {
    throw Error('Arrays must have the same length')
  }
  if (p.length === 0) {
    return NaN
  }

  // Q(x) = 0 with P(x) > 0 causes a term to diverge.
  if (hasZeroQWithNonZeroP(p, q)) {
    return Infinity
  }

  // Calculate sum over all P(x) > 0 elements.
  return neumaier(p.filter(d => d > 0).map((pi, i) => pi * Math.log(pi / q[i])))
}

function hasZeroQWithNonZeroP (p, q) {
  return q.filter((qi, i) => qi === 0 && p[i] !== 0).length > 0
}
