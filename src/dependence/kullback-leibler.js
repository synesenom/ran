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
 * @returns {(number|undefined)} The Kullback-Leibler divergence if none of the distributions are empty and Q(x) = 0
 * implies that P(x) = 0 for all x, otherwise undefined.
 * @example
 *
 * ran.dependence.kullbackLeibler([0.1, 0.2, 0.7], [])
 * // => undefined
 *
 * ran.dependence.kullbackLeibler([0.1, 0.2, 0.7], [0.1, 0.2, 0.3, 0.4])
 * // => undefined
 *
 * ran.dependence.kullbackLeibler([0.1, 0.3, 0.6], [0.333, 0.333, 0.334])
 * // => 0.19986796234715937
 *
 * ran.dependence.kullbackLeibler([0.333, 0.333, 0.334], [0.1, 0.3, 0.6])
 * // => 0.2396882491444514
 */
export default function (p, q) {
  if (p.length === 0 || q.length === 0 || p.length !== q.length) {
    return undefined
  }

  // Check Q(x) = 0 => P(x) = 0 implication.
  if (q.filter((qi, i) => qi === 0 && p[i] !== 0).length > 0) {
    return undefined
  }

  // Calculate sum over all P(x) > 0 elements.
  return neumaier(p.filter(d => d > 0).map((pi, i) => pi * Math.log(pi / q[i])))
}
